import csv
import os
import sqlite3
import tracemalloc
import random
import random

class SB_info:
    def __init__(self, measure_memory=False, db_path=None):
        if measure_memory:
            tracemalloc.start() # メモリ計測開始
        self.typed_heads = set()

        # このファイル(SB_info.py)のあるディレクトリを取得
        base_dir = os.path.dirname(os.path.abspath(__file__))
        # dicフォルダへのパスを作成 (backend/dic/...)
        dic_dir = os.path.join(base_dir, "dic")
        
        # SQLiteデータベースのパス
        self.db_path = db_path or os.path.join(dic_dir, "dictionary.db")
        
        self.conn = None
        should_rebuild = True

        # 既存のDBがあり、データが入っているか確認
        if os.path.exists(self.db_path):
            try:
                self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
                # 基本設定は接続のたびに行う
                self.conn.execute("PRAGMA cache_size = -2000")
                self.conn.execute("PRAGMA synchronous = OFF")
                
                cursor = self.conn.execute("SELECT count(*) FROM words")
                if cursor.fetchone()[0] > 0:
                    should_rebuild = False
                    # インデックスがなければ作成（既存DBへの対応）
                    self.conn.execute("CREATE INDEX IF NOT EXISTS idx_word_head ON words(substr(word, 1, 1))")
                    
                    # メモリ上のキャッシュ(typed_heads)だけ復元する
                    # 最初の1文字目を効率的に取得
                    cursor = self.conn.execute("SELECT DISTINCT substr(word, 1, 1) FROM words WHERE type1 != ''")
                    for row in cursor:
                        if row[0]: self.typed_heads.add(row[0])
            except sqlite3.Error:
                if self.conn: self.conn.close()
                should_rebuild = True

        if should_rebuild:
            if os.path.exists(self.db_path):
                try:
                    os.remove(self.db_path)
                except OSError:
                    pass

            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.conn.execute("PRAGMA cache_size = -2000")
            self.conn.execute("PRAGMA synchronous = OFF")
            self.conn.execute("PRAGMA journal_mode = MEMORY") # ディスクI/O削減
            
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS words (
                    word TEXT PRIMARY KEY,
                    type1 TEXT,
                    type2 TEXT
                )
            ''')
            # 検索用のインデックス作成
            self.conn.execute("CREATE INDEX IF NOT EXISTS idx_word_head ON words(substr(word, 1, 1))")

            # チャンク読み込み関数
            def insert_chunks(file_path, is_typed=False):
                CHUNK_SIZE = 10000
                with open(file_path, 'r', encoding='utf-8-sig') as f:
                    batch = []
                    for line in f:
                        line = line.strip().lstrip('\ufeff')
                        if not line: continue
                        
                        if is_typed:
                            parts = line.split()
                            word = parts[0]
                            t1 = parts[1] if len(parts) > 1 else ""
                            t2 = parts[2] if len(parts) > 2 else ""
                            self.typed_heads.add(word[0])
                            batch.append((word, t1, t2))
                        else:
                            batch.append((line, "", ""))
                        
                        if len(batch) >= CHUNK_SIZE:
                            if is_typed:
                                self.conn.executemany("INSERT OR REPLACE INTO words VALUES (?, ?, ?)", batch)
                            else:
                                self.conn.executemany("INSERT OR IGNORE INTO words VALUES (?, ?, ?)", batch)
                            batch = []
                    
                    if batch:
                        if is_typed:
                            self.conn.executemany("INSERT OR REPLACE INTO words VALUES (?, ?, ?)", batch)
                        else:
                            self.conn.executemany("INSERT OR IGNORE INTO words VALUES (?, ?, ?)", batch)
                self.conn.commit()

            insert_chunks(os.path.join(dic_dir, "notype.csv"), is_typed=False)
            insert_chunks(os.path.join(dic_dir, "typed.csv"), is_typed=True)

        
        self.ability_rank_from_power = {
            0.25:-6 ,   0.28:-5 ,   0.33:-4 ,   0.4:-3 ,   0.5:-2   ,   0.66:-1 ,   1.0:0 ,
            1.5:1   ,   2.0:2     ,   2.5:3   ,   3.0:4    ,   3.5:5    ,   4.0:6
        }

        self.power_from_ability_rank = {
            -6:0.25 ,   -5:0.28 ,   -4:0.33 ,   -3:0.4 ,   -2:0.5   ,   -1:0.66 ,   0:1.0 ,
            1:1.5   ,   2:2.0     ,   3:2.5   ,   4:3.0    ,   5:3.5    ,   6:4.0   
        }

        if measure_memory:
            # メモリ使用量を表示
            current, peak = tracemalloc.get_traced_memory()
            print(f"DB作成時のメモリ使用量: 現在 {current / 1024 / 1024:.2f} MB / ピーク {peak / 1024 / 1024:.2f} MB")
            tracemalloc.stop()
        
    def include_in_all_words(self,word:str):
        """入力した単語が辞書に含まれているか判別します"""
        # マルチスレッド対応のため、検索のたびにカーソルを作成・実行
        cursor = self.conn.execute("SELECT 1 FROM words WHERE word = ?", (word,))
        return cursor.fetchone() is not None
    
    def include_in_typed_words(self,word):
        """入力した単語がタイプ付き単語として登録されているか判定します"""
        # type1が空文字でないものをタイプ付きとみなす
        cursor = self.conn.execute("SELECT 1 FROM words WHERE word = ? AND type1 != ''", (word,))
        return cursor.fetchone() is not None
    
    def include_in_typed_heads(self, head):
        """入力された頭文字をもつタイプ付き単語が存在するか判定します"""
        return head in self.typed_heads

    def get_types(self, word: str):
        """単語のタイプを取得します"""
        cursor = self.conn.execute("SELECT type1, type2 FROM words WHERE word = ?", (word,))
        res = cursor.fetchone()
        if res:
            return res
        return ("", "")

    def get_typed_word_candidates(self, head: str):
        """指定された文字で始まるタイプ付き単語のリストを返します"""
        # 作成したインデックスを使用して高速に候補を取得
        cursor = self.conn.execute(
            "SELECT word FROM words WHERE substr(word, 1, 1) = ? AND type1 != ''", 
            (head,)
        )
        candidates = [row[0] for row in cursor]
        random.shuffle(candidates)
        return candidates
    
    def get_next_initial(self, word:str) -> str:
        """
            しりとりの次の頭文字を返します
        Args:
            word (str): 最後に使用した文字

        Returns:
            str: 次の頭文字
        """
        if not word:
            return ""
        if(word[-1] == "ゃ"):return 'や'
        if(word[-1] == "ゅ"):return 'ゆ'
        if(word[-1] == "ょ"):return 'よ'
        if(word[-1] == "ぁ"):return 'あ'
        if(word[-1] == "ぃ"):return 'い'
        if(word[-1] == "ぅ"):return 'う'
        if(word[-1] == "ぇ"):return 'え'
        if(word[-1] == "ぉ"):return 'お'
        if(word[-1] == "っ"):return 'つ'
        if(word[-1] == "ぢ"):return 'じ'
        if(word[-1] == "づ"):return 'ず'
        if(word[-1] == "を"):return 'お'
        if(word[-1] == "ー"):return self.get_next_initial(word[0:len(word) - 1])
        return word[-1]

    TYPE_NUMBER = {
        "暴力":0     ,   "食べ物":1  ,   "地名":2    ,   "社会"  :3  ,   "動物":4    ,   "感情"    :5,
        "植物":6     ,   "理科"  :7  ,   "遊び":8    ,   "人物"  :9  ,   "服飾":10   ,   "工作"    :11,
        "芸術":12    ,   "人体"  :13 ,   "時間":14   ,   "機械"  :15 ,   "医療":16   ,   "物語"    :17,
        "暴言":18    ,   "数学"  :19 ,   "天気":20   ,   "虫"    :21 ,   "宗教":22   ,   "スポーツ":23,
        "ノーマル":24,   "":25
    }

    TYPE_TABLE = [
        #0: Normal, 1: Effective, 2: Not Effective, 3: No Damage
        [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 3, 3, 2, 1, 1, 1 ,0], # Violence
        [ 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 ,3], # Food
        [ 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ,0], # Place
        [ 1, 0, 0, 2, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0 ,0], # Society
        [ 2, 1, 0, 0, 2, 0, 1, 2, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0 ,0], # Animal
        [ 2, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 3, 0, 0, 2, 2, 0, 0, 2, 0, 0 ,0], # Emotion
        [ 0, 1, 1, 0, 2, 0, 2, 0, 2, 0, 2, 2, 0, 1, 1, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0 ,0], # Plant
        [ 0, 0, 0, 0, 1, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0 ,0], # Science
        [ 2, 2, 0, 0, 0, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0 ,0], # Playing
        [ 2, 0, 0, 2, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0 ,0], # Person
        [ 2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ,0], # Clothing
        [ 2, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0 ,0], # Work
        [ 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ,0], # Art
        [ 2, 1, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0 ,0], # Body
        [ 0, 1, 0, 0, 0, 0, 2, 0, 2, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ,0], # Time
        [ 2, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0 ,0], # Machine
        [ 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 ,3], # Health
        [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0 ,0], # Tale
        [ 2, 2, 0, 1, 2, 1, 2, 0, 1, 1, 1, 0, 1, 1, 0, 2, 0, 0, 1, 1, 3, 2, 2, 1, 0 ,0], # Insult
        [ 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0 ,0], # Math
        [ 1, 1, 1, 1, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 2, 0, 1, 0 ,0], # Weather
        [ 1, 1, 0, 0, 1, 0, 1, 2, 0, 0, 2, 0, 0, 1, 0, 2, 1, 0, 1, 0, 0, 2, 0, 0, 0 ,0], # Bug
        [ 2, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 2, 0, 0 ,0], # Religion
        [ 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0 ,0], # Sports
        [ 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 ,0], # Normal
        [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ,0]  # NoType        
    ]

    def _type_to_num(self, input_string):
        return self.TYPE_NUMBER.get(input_string, -1)

    def type_effect(self,at1,at2,dt1,dt2):
        """
            タイプ相性を計算し倍率を返します。
        """
        ret = 1
        a = self.TYPE_TABLE[self._type_to_num(at1)][self._type_to_num(dt1)]
        b = self.TYPE_TABLE[self._type_to_num(at1)][self._type_to_num(dt2)]
        c = self.TYPE_TABLE[self._type_to_num(at2)][self._type_to_num(dt1)]
        d = self.TYPE_TABLE[self._type_to_num(at2)][self._type_to_num(dt2)]

        for i in [a,b,c,d]:
            if(i == 1):ret *= 2
            if(i == 2):ret *= 0.5
            if(i == 3):ret = 0

        return ret

    #攻撃・防御倍率を受け取り能力ランクを返す
    def power_to_rank(self, ability_value):
        return self.ability_rank_from_power.get(ability_value, 0)

    def rank_to_power(self, ability_value):
        return self.power_from_ability_rank.get(ability_value, 1.0)

# このファイルを直接実行した時だけメモリ計測を行う
if __name__ == "__main__":
    SB_info(measure_memory=True)
