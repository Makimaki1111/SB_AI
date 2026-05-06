import sys
import os

# backendディレクトリをパスに追加
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from battle import SingleBattle
from double_battle import DoubleBattle

def test_single_battle_personalization():
    print("Testing SingleBattle win personalization...")
    # P1 vs P2
    p1_id = "p1"
    p2_id = "p2"
    battle = SingleBattle(p1_id, p2_id, sb_info=None) # sb_info is not used for win check
    
    # Force P2 win (winner_team = 1)
    battle.winner_team = 1
    
    # Check is_player_winner
    assert battle.is_player_winner(p1_id) == False
    assert battle.is_player_winner(p2_id) == True
    print("is_player_winner check passed.")

    # Check _personalize_events
    events = [{"type": "battle_result", "message": "FIXME", "winner_team": 1}]
    
    # For P1 (Loser)
    battle._personalize_events(events, False)
    assert events[0]["message"] == "あいてとの勝負に負けた…"
    
    # For P2 (Winner)
    events[0]["message"] = "FIXME"
    battle._personalize_events(events, True)
    assert events[0]["message"] == "あいてとの勝負に勝った！"
    print("Event personalization check passed.")

def test_double_battle_personalization():
    print("\nTesting DoubleBattle win personalization...")
    # Team 1 (P1) vs Team 2 (P2)
    p1_id = "p1"
    p2_id = "p2"
    battle = DoubleBattle("room1", [p1_id], [p2_id], sb_info=None, profiles={})
    
    # Force Team 1 win (winner_team = 0)
    battle.winner_team = 0
    
    # Check is_player_winner
    assert battle.is_player_winner(p1_id) == True
    assert battle.is_player_winner(p2_id) == False
    print("is_player_winner check passed.")

    # Check _personalize_events
    events = [{"type": "battle_result", "message": "FIXME", "winner_team": 0}]
    
    # For P1 (Winner)
    battle._personalize_events(events, True)
    assert events[0]["message"] == "あいてとの勝負に勝った！"
    
    # For P2 (Loser)
    events[0]["message"] = "FIXME"
    battle._personalize_events(events, False)
    assert events[0]["message"] == "あいてとの勝負に負けた…"
    print("Event personalization check passed.")

if __name__ == "__main__":
    try:
        test_single_battle_personalization()
        test_double_battle_personalization()
        print("\nAll tests passed!")
    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
