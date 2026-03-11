import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import List, Dict

# ゲームの定数
MAX_HP = 60
MAX_RANK = 6
MAX_POISON_TURNS = 16
MAX_LEECH_TURNS = 4
FOOD_LIMIT = 6
MEDICAL_LIMIT = 5

# 五十音（ひらがな）の基本文字（濁点・半濁点は清音に変換して扱う方針でも可、今回は簡易的に全種類）
CHARS = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉゃゅょっー"
CHAR_TO_IDX = {c: i for i, c in enumerate(CHARS)}
NUM_CHARS = len(CHARS)

# 全タイプ（25種類 + 無属性）
TYPES = [
    "暴力", "食べ物", "地名", "社会", "動物", "感情", "植物", "理科", "遊び", "人物",
    "服飾", "工作", "芸術", "人体", "時間", "機械", "医療", "物語", "暴言", "数学",
    "天気", "虫", "宗教", "スポーツ", "ノーマル", ""
]
TYPE_TO_IDX = {t: i for i, t in enumerate(TYPES)}
NUM_TYPES = len(TYPES)

# TODO: 実装済みの全特性IDリストを取得可能にする
# 今回は現在実装されている代表的な特性をハードコード
ABILITIES = [
    "ikaku", "debugger", "passion", "kyojin", "ikasui", "rocknroll", "mukimuki", 
    "training", "hoken", "procrastination", "karate", "zuboshi", "ishokudogen", 
    "kachikochi", "dokubari", "taifuikka", "yadorigi", "jikken", "global", 
    "shinkoushin", "revolution", "calculation", "layering", "arming", "long_word"
]
ABILITY_TO_IDX = {a: i for i, a in enumerate(ABILITIES)}
NUM_ABILITIES = len(ABILITIES)


class StateEncoder:
    """
    しりとりバトルの状態 (SimState 等) を、ニューラルネットへ入力できる 1D ベクトル (Tensor) に変換するクラス
    """
    
    @classmethod
    def encode(cls, state, my_id: str, hide_foe_ability: bool = False) -> np.ndarray:
        """
        state: ai_simulator.SimState と互換のあるオブジェクト
        my_id: 推論を行う側 (CPU) の player id
        hide_foe_ability: 相手の特性を未知とする場合はTrue (One-hotベクトルを全て0にする)
        """
        # 自分がPlayer1かPlayer2かを判定
        am_p1 = (state.player1.id == my_id)
        me = state.player1 if am_p1 else state.player2
        foe = state.player2 if am_p1 else state.player1
        
        features = []

        # --- 1. スカラー値の正規化 (0.0 ~ 1.0) ---
        features.append(me.hp / MAX_HP)
        features.append(foe.hp / MAX_HP)
        features.append((me.attack_rank + 6) / 12.0)  # -6~6 を 0~1 に
        features.append((foe.attack_rank + 6) / 12.0)
        features.append((me.defense_rank + 6) / 12.0)
        features.append((foe.defense_rank + 6) / 12.0)
        
        # アイテム・変更残数
        features.append((FOOD_LIMIT - me.food_count) / FOOD_LIMIT)
        features.append((FOOD_LIMIT - foe.food_count) / FOOD_LIMIT)
        features.append((MEDICAL_LIMIT - me.medical_count) / MEDICAL_LIMIT)
        features.append((MEDICAL_LIMIT - foe.medical_count) / MEDICAL_LIMIT)
        features.append(me.ability_change_count / 2.0)  # 最大2回

        # 相手の残変更回数も隠す
        if hide_foe_ability:
            features.append(0.5) # 未知の場合は平均値(1回分=0.5)を代入
        else:
            features.append(foe.ability_change_count / 2.0)
            
        # 推理用データ (相手の直前の行動)
        # まだ誰も行動していない時は便宜上0を入れる
        features.append(state.last_turn_damage / MAX_HP) # 直前の相手の攻撃ダメージ
        features.append(min(state.last_turn_word_length / 20.0, 1.0)) # 相手の直前の単語長（最大20文字程度でクリップ）
        
        # 状態異常ターン数
        features.append(min(me.poison_turns / MAX_POISON_TURNS, 1.0))
        features.append(min(foe.poison_turns / MAX_POISON_TURNS, 1.0))
        features.append(me.leech_turns / MAX_LEECH_TURNS)
        features.append(foe.leech_turns / MAX_LEECH_TURNS)

        # --- 2. カテゴリ値の One-Hot エンコーディング ---
        
        # 自分の特性 (Ability)
        me_ab_vec = np.zeros(NUM_ABILITIES)
        if me.ability in ABILITY_TO_IDX: me_ab_vec[ABILITY_TO_IDX[me.ability]] = 1.0
        features.extend(me_ab_vec)
        
        # 相手の特性 (未知の場合はすべて0のままにする)
        foe_ab_vec = np.zeros(NUM_ABILITIES)
        if not hide_foe_ability and foe.ability in ABILITY_TO_IDX: 
            foe_ab_vec[ABILITY_TO_IDX[foe.ability]] = 1.0
        features.extend(foe_ab_vec)

        # 直前のタイプ (防御相性のため) 最大2つ
        me_type_vec = np.zeros(NUM_TYPES)
        for t in me.types:
            if t in TYPE_TO_IDX: me_type_vec[TYPE_TO_IDX[t]] = 1.0
        features.extend(me_type_vec)
        
        foe_type_vec = np.zeros(NUM_TYPES)
        for t in foe.types:
            if t in TYPE_TO_IDX: foe_type_vec[TYPE_TO_IDX[t]] = 1.0
        features.extend(foe_type_vec)

        # 場に出ている文字 (次に自分が「この文字から始まる単語」を言わなければならない)
        char_vec = np.zeros(NUM_CHARS)
        if state.character in CHAR_TO_IDX:
            char_vec[CHAR_TO_IDX[state.character]] = 1.0
        features.extend(char_vec)

        # --- 3. 使用済み単語の表現 ---
        # 実際には「何万個もの単語」をそのまま入れると次元が爆発する。
        # 今回は「どの文字から始まる単語がどれくらい消費されたか」の頻度ベクトルに圧縮するアプローチをとる。
        used_heads_count = np.zeros(NUM_CHARS)
        for w in state.used_words:
            if w and w[0] in CHAR_TO_IDX:
                used_heads_count[CHAR_TO_IDX[w[0]]] += 1.0
        
        # 最大100個くらいだとして適当に正規化
        used_heads_count = used_heads_count / 100.0 
        features.extend(used_heads_count)

        # 全特徴量を結合して 1D Numpy Array に
        return np.array(features, dtype=np.float32)

    @classmethod
    def get_input_dim(cls):
        """ニューラルネットに入力する次元数を計算 (コンストラクタで利用)"""
        scalar_features = 18 # ability items + deduction features added
        ability_features = NUM_ABILITIES * 2
        type_features = NUM_TYPES * 2
        char_features = NUM_CHARS  # 現在の文字
        used_words_features = NUM_CHARS # 使用済み頭文字カウント
        return scalar_features + ability_features + type_features + char_features + used_words_features


class ShiritoriNet(nn.Module):
    """
    AlphaZero風のデュアルヘッド・ニューラルネットワーク。
    しりとりの場合、出力する手（Policy）は「数万単語」になりうるが、
    そのまま出力させると巨大すぎるため、
    「次に選ぶべき単語の強さ（特徴）」を表現する抽象度を持たせる方法等あるが、
    今回はシンプルに「盤面の勝率予測(Value)」を強力に学習する。
    ※今回はMCTSと組み合わせるため、Policyは「使える単語数百個」の尤度を出力する形にする。
    
    しかし、単語リストは状態によって動的に変わるため、ここでは固定長の特徴量に落とし込むモデルとする。
    1. Value Head: 現在の盤面から勝てる確率 (-1.0 ~ 1.0)
    2. Policy Head: 代替手法として「次に相手にどの文字を渡すべきか」の50音ごとの優先度予測を出力し、
                    MCTSの事前確率(Prior Probability)のベースにする。
    """
    def __init__(self, input_dim=None, hidden_dim=256):
        super(ShiritoriNet, self).__init__()
        if input_dim is None:
            input_dim = StateEncoder.get_input_dim()
            
        print(f"Network Input Dimension: {input_dim}")
        
        # 共通の特徴抽出層 (Shared Representation)
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.bn1 = nn.BatchNorm1d(hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.bn2 = nn.BatchNorm1d(hidden_dim)
        self.fc3 = nn.Linear(hidden_dim, hidden_dim)
        self.bn3 = nn.BatchNorm1d(hidden_dim)

        # 1. 価値判断ヘッド (Value Head) -> 「この盤面勝てる？」
        self.val_fc1 = nn.Linear(hidden_dim, int(hidden_dim/2))
        self.val_fc2 = nn.Linear(int(hidden_dim/2), 1)

        # 2. 次の手をどうするべきかヘッド (Policy Head)
        # 本来は全合法手(数万)の確率を出したいが、ここでは「次の単語の語尾（相手に渡す文字）」の予測とする
        self.pol_fc1 = nn.Linear(hidden_dim, int(hidden_dim/2))
        self.pol_fc2 = nn.Linear(int(hidden_dim/2), NUM_CHARS)

    def forward(self, x):
        # 共通層
        x = F.relu(self.bn1(self.fc1(x)))
        x = F.relu(self.bn2(self.fc2(x)))
        x = F.relu(self.bn3(self.fc3(x)))

        # Value Head
        val = F.relu(self.val_fc1(x))
        val = torch.tanh(self.val_fc2(val))  # -1.0 ~ 1.0 に収束させる

        # Policy Head (次の文字ごとの魅力度)
        pol = F.relu(self.pol_fc1(x))
        pol_logits = self.pol_fc2(pol)
        # Log Softmax等にするかは強化学習の損失関数に合わせて調整
        pol_probs = F.softmax(pol_logits, dim=-1)

        return pol_probs, val

# モデルのテスト
if __name__ == "__main__":
    net = ShiritoriNet()
    dummy_input = torch.rand(2, StateEncoder.get_input_dim()) # バッチサイズ2
    p, v = net(dummy_input)
    print("Value output shape:", v.shape)   # (2, 1)
    print("Policy output shape:", p.shape)  # (2, NUM_CHARS)
