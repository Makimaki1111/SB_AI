import sys
import os

# プロジェクトルートをパスに追加
sys.path.append(os.getcwd())

try:
    from backend.battle import SingleBattle
    from backend.double_battle import DoubleBattle
    from backend.SB_info import SB_info
except ImportError:
    from battle import SingleBattle
    from double_battle import DoubleBattle
    from SB_info import SB_info

def test_extreme_survivor_double():
    print("Testing extreme cases (single survivor in DoubleBattle)...")
    sb_info = SB_info()
    battle = DoubleBattle("1v1_double", ["p1_id", "p1_id"], ["p2_id", "p2_id"], sb_info)
    
    # p1a 以外全員倒す
    for p in battle.players:
        if p.id != "p1a":
            p.hp = 0
            
    # インデックスがどこにあっても、p1a が返ってくるべき
    for _ in range(10):
        actor = battle.get_current_actor()
        assert actor.id == "p1a"
        battle.advance_turn()
        
    print("Extreme survivor test passed!")

def test_all_defeated_safety():
    print("Testing safety logic when everyone is defeated...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info)
    
    # 全員倒す
    for p in battle.players:
        p.hp = 0
        
    # get_current_actor が無限ループせずに戻ってくるか (実装したガードの確認)
    try:
        actor = battle.get_current_actor()
        assert actor is not None # 何かしら（最後にいた人など）が返る
        print("All defeated safety test passed!")
    except Exception as e:
        print(f"FAILED: Infinite loop or crash detected: {e}")
        raise e

def test_integration_attack_advances_turn():
    print("Testing integration: attack correctly advances turn...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info)
    
    initial_actor = battle.get_current_actor()
    
    # しりとりが成立するように初期文字を「り」に強制設定
    battle.character = "り"
    
    # 攻撃実行 (validな単語)
    res = battle.try_attack(initial_actor.owner_id, "りんご")
    
    # エラーチェックを厳密に
    if isinstance(res, dict) and res.get("type") == "error":
        print(f"Attack failed unexpectedly: {res.get('message')}")
        assert False, f"Attack failed: {res.get('message')}"
    
    new_actor = battle.get_current_actor()
    assert new_actor.id != initial_actor.id
    assert battle.last_actor_id == initial_actor.id
    print("Integration attack test passed!")

if __name__ == "__main__":
    try:
        test_extreme_survivor_double()
        test_all_defeated_safety()
        test_integration_attack_advances_turn()
        print("\nAll extreme-case tests passed successfully!")
    except Exception as e:
        print(f"\nExtreme-case test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
