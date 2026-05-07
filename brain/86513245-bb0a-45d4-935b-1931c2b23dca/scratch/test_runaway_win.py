
import sys
import os

# backendディレクトリをパスに追加
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from battle import SingleBattle
from SB_info import SB_info
from unittest.mock import MagicMock

def test_opponent_run_away():
    print("=== Testing Opponent Run Away Message ===")
    
    # Mock SB_info
    sb_info = MagicMock(spec=SB_info)
    sb_info.get_next_initial.return_value = "い"
    
    # User 1 (P1) vs User 2 (P2)
    battle = SingleBattle("user1", "user2", sb_info)
    
    # User 2 runs away
    print("User 2 (Opponent) runs away...")
    battle.handle_disconnection("user2")
    
    print(f"Winner Team: {battle.winner_team}") # Should be 0 (P1)
    
    # Get response for User 1 (P1)
    res1 = battle.get_personalized_response(battle._make_response(), "user1")
    
    # Find battle_result event
    result_event = next((e for e in res1["events"] if e["type"] == "battle_result"), None)
    
    if result_event:
        print(f"P1 Result Message: {result_event['message']}")
        if "勝った" in result_event["message"]:
            print("SUCCESS: Winner (P1) sees 'Won' message.")
        else:
            print(f"FAILURE: Winner (P1) sees '{result_event['message']}'")
    else:
        print("FAILURE: No battle_result event found for P1.")

    # --- Test Case 2: P1 runs away, P2 should see 'Won' ---
    print("\n--- Test Case 2: P1 runs away ---")
    battle2 = SingleBattle("user1", "user2", sb_info)
    battle2.handle_disconnection("user1")
    print(f"Winner Team: {battle2.winner_team}") # Should be 1 (P2)
    
    res2 = battle2.get_personalized_response(battle2._make_response(), "user2")
    result_event2 = next((e for e in res2["events"] if e["type"] == "battle_result"), None)
    
    if result_event2:
        print(f"P2 Result Message: {result_event2['message']}")
        if "勝った" in result_event2["message"]:
            print("SUCCESS: Winner (P2) sees 'Won' message.")
        else:
            print(f"FAILURE: Winner (P2) sees '{result_event2['message']}'")
    else:
        print("FAILURE: No battle_result event found for P2.")

if __name__ == "__main__":
    test_opponent_run_away()
