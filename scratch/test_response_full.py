import sys
import os

# プロジェクトルートをパスに追加
sys.path.append(os.getcwd())

try:
    from backend.battle import SingleBattle
    from backend.double_battle import DoubleBattle
    from backend.SB_info import SB_info
    from backend.player import Player
    from backend.constants import MAX_HP
except ImportError:
    from battle import SingleBattle
    from double_battle import DoubleBattle
    from SB_info import SB_info
    from player import Player
    from constants import MAX_HP

def test_battle_data_accuracy():
    print("Testing data accuracy in response...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info)
    
    # 状態を少し変更
    battle.player1.hp = 50
    battle.player1.attack_rank = 2
    battle.player1.types = ["ノーマル", "動物"]
    battle.player1.poison_turns = 1
    
    res = battle._make_response()
    p1_state = res["state"]["characters"]["p1_id"]
    
    assert p1_state["hp"] == 50
    assert p1_state["max_hp"] == MAX_HP
    assert p1_state["attack_rank"] == 2
    assert p1_state["types"] == ["ノーマル", "動物"]
    assert p1_state["is_poison"] is True
    print("Data accuracy test passed!")

def test_event_serialization():
    print("Testing event serialization...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info)
    
    # イベントを追加
    battle.events.append({
        "type": "damage",
        "message": "テストダメージ",
        "target": "p2_id",
        "damage": 10
    })
    
    res = battle._make_response()
    events = res["events"]
    assert len(events) == 2 # マッチングした！ + ダメージ
    assert events[1]["type"] == "damage"
    assert events[1]["damage"] == 10
    assert battle.events == [] # 送信後はクリアされていること
    print("Event serialization test passed!")

def test_personalization():
    print("Testing personalization (ally/foe masking)...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info)
    battle.player2.ability = "ikaku"
    
    base_res = battle._make_response()
    # P1視点でパーソナライズ
    pers_res = battle.get_personalized_response(base_res, "p1_id")
    
    # 自分のターンチェック (ランダムなので現在の actor と一致するか)
    current_actor_id = base_res["state"]["current_actor_id"]
    assert pers_res["state"]["is_my_turn"] == (current_actor_id == "p1_id")
    
    # 敵(P2)の特性がマスクされているか
    assert pers_res["state"]["characters"]["p2_id"]["ability"] == "secret"
    # 自分(P1)の特性は見えているか
    assert pers_res["state"]["characters"]["p1_id"]["ability"] == battle.player1.ability
    
    # マッピング情報
    assert pers_res["info"]["id_to_ui_map"]["p1_id"] == "ally"
    assert pers_res["info"]["id_to_ui_map"]["p2_id"] == "foe"
    print("Personalization test passed!")

def test_double_battle_personalization():
    print("Testing DoubleBattle personalization...")
    sb_info = SB_info()
    # P1視点
    battle = DoubleBattle("1v1_double", ["p1_id", "p1_id"], ["p2_id", "p2_id"], sb_info)
    base_res = battle._make_response()
    pers_res = battle.get_personalized_response(base_res, "p1_id")
    
    # チーム2の特性がマスクされているか
    assert pers_res["state"]["characters"]["p2a"]["ability"] == "secret"
    assert pers_res["state"]["characters"]["p2b"]["ability"] == "secret"
    # チーム1は見えている
    assert pers_res["state"]["characters"]["p1a"]["ability"] != "secret"
    
    print("DoubleBattle personalization test passed!")

if __name__ == "__main__":
    try:
        test_battle_data_accuracy()
        test_event_serialization()
        test_personalization()
        test_double_battle_personalization()
        print("\nAll double-check tests passed successfully!")
    except Exception as e:
        print(f"\nDouble-check failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
