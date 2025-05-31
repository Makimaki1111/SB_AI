import csv
from collections import defaultdict

class SB_info:
    def __init__(self):
        self.all_dict = defaultdict(set) # self.all_dict[頭文字] = set(単語一覧)の辞書
        self.typed_dict = defaultdict(lambda:("","")) # 単語のタイプを返す辞書

        with open("C:/Users/Excus/AppData/Local/Programs/Python/Python311/Lib/site-packages/SB_tools/dic/notype.csv", 'r', encoding='utf-8-sig') as typed_file:
                reader = csv.reader(typed_file)
                typed_words_not_processing = list(reader)
        for i in typed_words_not_processing:
            word = i[0]
            self.all_dict[word[0]].add(word) 
       
        with open("C:/Users/Excus/AppData/Local/Programs/Python/Python311/Lib/site-packages/SB_tools/dic/typed.csv", 'r', encoding='utf-8-sig') as typed_file:
                reader = csv.reader(typed_file)
                typed_words_not_processing = list(reader)
        for i in typed_words_not_processing:
            #1個目:言葉、2個目:タイプ1、3個目:タイプ2
            word,*types = i[0].split()
            if(len(types) == 1):types.append("")
            self.typed_dict[word] = tuple(types)
        
    def include_in_all_words(self,word:str):
        """
            入力した単語が辞書に含まれているか判別します
        """
        return word in self.all_dict[word[0]]
    
    def inclue_in_typed_words(self,word):
        """
            入力した単語がタイプ付き単語として登録されているか判定します
        """
        return word in self.typed_dict
    
    def get_next_initial(self, word:str) -> str:
        """
            しりとりの次の頭文字を返します
        Args:
            word (str): 最後に使用した文字

        Returns:
            str: 次の頭文字
        """
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

    def type_effect(self,at1,at2,dt1,dt2):
        """
            タイプ相性を計算し倍率を返します。
        Args:
            at1 (str): 攻撃タイプ1
            at2 (str): 攻撃タイプ2
            dt1 (str): 防御タイプ1
            dt2 (str): 防御タイプ2
        """
        type_table = [
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

        def _type_to_num(input_string):
            """
                タイプ名を対応する数字に変換
            Args:
                input_string (str): タイプ名

            Returns:
                対応する番号
            """
            if input_string in type_number:
                return type_number[input_string]
            else:
                return -1

        type_number = {
                "暴力":0     ,   "食べ物":1  ,   "地名":2    ,   "社会"  :3  ,   "動物":4    ,   "感情"    :5,
                "植物":6     ,   "理科"  :7  ,   "遊び":8    ,   "人物"  :9  ,   "服飾":10   ,   "工作"    :11,
                "芸術":12    ,   "人体"  :13 ,   "時間":14   ,   "機械"  :15 ,   "医療":16   ,   "物語"    :17,
                "暴言":18    ,   "数学"  :19 ,   "天気":20   ,   "虫"    :21 ,   "宗教":22   ,   "スポーツ":23,
                "ノーマル":24,   "":25
        }        

        ret = 1
        a = type_table[_type_to_num(at1)][_type_to_num(dt1)]
        b = type_table[_type_to_num(at1)][_type_to_num(dt2)]
        c = type_table[_type_to_num(at2)][_type_to_num(dt1)]
        d = type_table[_type_to_num(at2)][_type_to_num(dt2)]

        for i in [a,b,c,d]:
            if(i == 1):ret *= 2
            if(i == 2):ret *= 0.5
            if(i == 3):ret = 0

        return ret