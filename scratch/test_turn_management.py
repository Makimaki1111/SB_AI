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

def test_turn_rotation_single():
    print("Testing SingleBattle turn rotation...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info)
    
    initial_actor = battle.get_current_actor()
    initial_turn = battle.turn
    
    # 1ターン進める
    battle.advance_turn()
    next_actor = battle.get_current_actor()
    assert next_actor.id != initial_actor.id
    assert battle.turn == initial_turn # まだ1周してない
    
    # もう1ターン進める (1周)
    battle.advance_turn()
    actor_back = battle.get_current_actor()
    assert actor_back.id == initial_actor.id
    assert battle.turn == initial_turn + 1 # 1周したので増える
    print("SingleBattle turn rotation test passed!")

def test_defeated_skip():
    print("Testing defeated player skip logic...")
    sb_info = SB_info()
    battle = DoubleBattle("1v1_double", ["p1_id", "p1_id"], ["p2_id", "p2_id"], sb_info)
    
    # turn_order: [p1a, p2a, p1b, p2b] (またはその逆)
    # 現在のactorを取得
    actor1 = battle.get_current_actor()
    
    # 次のactorを倒れた状態にする
    idx_next = (battle.current_turn_index + 1) % 4
    target_next = battle.turn_order[idx_next]
    target_next.hp = 0 # 倒す
    
    # ターンを進める
    battle.advance_turn()
    
    # get_current_actor は倒れた人をスキップして次を返すべき
    actor2 = battle.get_current_actor()
    assert actor2.id != target_next.id
    assert not actor2.is_defeated
    
    print("Defeated skip test passed!")

def test_cpu_turn_detection():
    print("Testing CPU turn detection...")
    sb_info = SB_info()
    # P2をCPUにする
    battle = SingleBattle("p1_id", "p2_id", sb_info, is_cpu=True)
    
    # P2の番まで進める
    loops = 0
    while battle.get_current_actor().id != "p2_id" and loops < 2:
        battle.advance_turn()
        loops += 1
        
    assert battle.is_cpu_turn is True
    
    # P1に戻す
    battle.advance_turn()
    assert battle.is_cpu_turn is False
    print("CPU turn detection test passed!")

if __name__ == "__main__":
    try:
        test_turn_rotation_single()
        test_defeated_skip()
        test_cpu_turn_detection()
        print("\nAll turn management tests passed successfully!")
    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
