import sys
import os
import random

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

def test_cpu_attack_success():
    print("Testing CPU attack success...")
    sb_info = SB_info()
    # P1(Player), P2(CPU)
    battle = SingleBattle("p1_id", "p2_id", sb_info, is_cpu=True)
    
    # P2のターンにする
    while battle.get_current_actor().id != "p2_id":
        battle.advance_turn()
        
    # CPU行動実行
    # 注: 内部で try_attack が呼ばれ、ターンが進むはず
    res = battle.execute_cpu_turn()
    
    assert res["type"] == "update"
    assert battle.get_current_actor().id == "p1_id" # ターンが戻っている
    print("CPU attack success test passed!")

def test_cpu_failure_single():
    print("Testing CPU failure (giving up) in SingleBattle...")
    sb_info = SB_info()
    battle = SingleBattle("p1_id", "p2_id", sb_info, is_cpu=True)
    
    # 候補をわざと無くすために、非常に珍しい文字にするか、候補を0にするモック
    battle.character = "ん" # 「ん」から始まる単語は通常ない
    
    while battle.get_current_actor().id != "p2_id":
        battle.advance_turn()
        
    res = battle.execute_cpu_turn()
    
    assert res["type"] == "battle_end"
    assert battle.winner_team == 0 # P1の勝利
    print("CPU failure single test passed!")

def test_cpu_failure_double():
    print("Testing CPU failure (knockout) in DoubleBattle...")
    sb_info = SB_info()
    # P1a, P1b vs P2a, P2b (CPU)
    battle = DoubleBattle("1v1_double", ["p1_id", "p1_id"], ["p2_id", "p2_id"], sb_info, is_cpu=True)
    
    battle.character = "ん" 
    
    # CPUの誰かのターンにする
    while not battle.get_current_actor().owner_id.startswith("cpu_") and not battle.get_current_actor().owner_id == "p2_id":
        battle.advance_turn()
    
    actor = battle.get_current_actor()
    res = battle.execute_cpu_turn()
    
    # そのキャラが倒れていること
    assert actor.hp == 0
    assert actor.is_defeated is True
    print("CPU failure double test passed!")

def test_cpu_target_selection_double():
    print("Testing CPU target selection in DoubleBattle...")
    sb_info = SB_info()
    battle = DoubleBattle("1v1_double", ["p1_id", "p1_id"], ["p2_id", "p2_id"], sb_info, is_cpu=True)
    
    actor = battle.p2a
    # 敵チームの片方を倒しておく
    battle.p1b.hp = 0
    
    # ターゲット選択を実行
    target_id = battle._select_cpu_target(actor)
    
    # 生きている p1a を狙うはず
    assert target_id == "p1a"
    print("CPU target selection test passed!")

def test_cpu_no_enemies():
    print("Testing CPU behavior when no enemies left...")
    sb_info = SB_info()
    battle = DoubleBattle("1v1_double", ["p1_id", "p1_id"], ["p2_id", "p2_id"], sb_info, is_cpu=True)
    
    # 敵チーム(Team 1)を全員倒す
    battle.p1a.hp = 0
    battle.p1b.hp = 0
    battle._check_win_condition()
    
    actor = battle.p2a
    target_id = battle._select_cpu_target(actor)
    
    assert target_id is None
    print("CPU no enemies test passed!")

if __name__ == "__main__":
    try:
        test_cpu_attack_success()
        test_cpu_failure_single()
        test_cpu_failure_double()
        test_cpu_target_selection_double()
        test_cpu_no_enemies()
        print("\nAll CPU action loop tests passed successfully!")
    except Exception as e:
        print(f"\nCPU test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
