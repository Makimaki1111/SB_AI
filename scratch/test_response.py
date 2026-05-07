import sys
import os

# プロジェクトルートをパスに追加
sys.path.append(os.getcwd())

try:
    from backend.battle import SingleBattle
    from backend.double_battle import DoubleBattle
    from backend.SB_info import SB_info
    from backend.player import Player
except ImportError:
    from battle import SingleBattle
    from double_battle import DoubleBattle
    from SB_info import SB_info
    from player import Player

def test_single_battle_response():
    print("Testing SingleBattle response...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info)
    res = battle._make_response()
    
    assert "state" in res
    assert "characters" in res["state"]
    assert len(res["state"]["characters"]) == 2
    assert "p1_id" in res["state"]["characters"]
    assert "p2_id" in res["state"]["characters"]
    print("SingleBattle response test passed!")

def test_double_battle_response():
    print("Testing DoubleBattle response...")
    sb_info = SB_info()
    battle = DoubleBattle("1v1_double", ["p1_id", "p1_id"], ["p2_id", "p2_id"], sb_info)
    res = battle._make_response()
    
    assert "state" in res
    assert "characters" in res["state"]
    assert len(res["state"]["characters"]) == 4
    print("DoubleBattle response test passed!")

if __name__ == "__main__":
    try:
        test_single_battle_response()
        test_double_battle_response()
        print("\nAll tests passed successfully!")
    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
