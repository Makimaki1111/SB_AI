import random
import uuid
from collections import defaultdict
try:
    from SB_info import SB_info
except ImportError:
    from backend.SB_info import SB_info

class BaseBattle:
    """
    シングルバトルとダブルバトルの共通ロジックを管理する基底クラス
    """
    def __init__(self, sb_info: SB_info, room_id: str = None):
        self.room_id = room_id or str(uuid.uuid4())
        self.sb_info = sb_info
        self.used = defaultdict(list)
        self.events = []
        self.turn = 0
        self.word = ""
        self.character = ""
        self.START_CHARACTERS = "あいうえおかきくけこさしすせそたちつてとなにねのはひふへほまみむめやゆよらりるれろわ"

    @property
    def is_finished(self) -> bool:
        """ゲームが終了しているかどうかを返す（サブクラスで実装）"""
        raise NotImplementedError

    def init_character(self):
        """開始文字をランダムに決定"""
        self.character = random.choice(self.START_CHARACTERS)

    def katakana_to_hiragana(self, text: str) -> str:
        """全角カタカナをひらがなに変換する"""
        if not text: return ""
        return "".join(chr(ord(c) - 96) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in text)

    def validate_word(self, word: str) -> tuple[str | None, dict | None]:
        """
        単語がしりとりルールおよび辞書に適合するかチェックする
        Returns:
            tuple[正規化済み単語, エラーレスポンス]
        """
        if self.is_finished:
            return None, {"type": "error", "message": "戦闘はすでに終了しています"}

        norm_word = self.katakana_to_hiragana(word)

        if not norm_word:
            return None, {"type": "error", "message": "単語を入力してください"}
        
        # 辞書チェック
        if not self.sb_info.include_in_all_words(norm_word) and not self.sb_info.include_in_typed_words(norm_word):
            return None, {"type": "error", "message": "辞書にない単語です"}
        
        # 使用済みチェック
        if norm_word in self.used:
            return None, {"type": "error", "message": "使用済みの単語です"}
        
        # 開始文字チェック
        if not norm_word.startswith(self.character):
            return None, {"type": "error", "message": f"「{self.character}」からはじまることばを入力してください"}
        
        # 「ん」終了チェック
        next_initial = self.sb_info.get_next_initial(norm_word)
        if next_initial == "ん":
            return None, {"type": "error", "message": "「ん」で終わっています"}
        
        # 次の文字が辞書に存在するかチェック
        if not self.sb_info.include_in_typed_heads(next_initial):
            return None, {"type": "error", "message": "禁止された単語です"}
        
        return norm_word, None

    def _type_check(self, word: str) -> list[str]:
        """単語のタイプを取得"""
        t1, t2 = self.sb_info.get_types(word)
        types = []
        if t1: types.append(t1)
        if t2: types.append(t2)
        return types

    def record_used_word(self, word: str, actor_id: str):
        """単語を使用済みリストに登録し、次の文字を更新"""
        # 既に正規化されているはずだが、念のため
        norm_word = self.katakana_to_hiragana(word)
        self.used[norm_word].append(actor_id)
        self.character = self.sb_info.get_next_initial(norm_word)
