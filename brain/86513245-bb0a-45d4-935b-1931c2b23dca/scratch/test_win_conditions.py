
import sys
import os

# backendディレクトリをパスに追加
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from battle import SingleBattle
from SB_info import SB_info
from unittest.mock import MagicMock

def run_win_test(description, action_func):
    print(f"\n=== Test: {description} ===")
    sb_info = MagicMock(spec=SB_info)
    sb_info.get_next_initial.return_value = "い"
    sb_info.type_effect.return_value = 1.0
    sb_info.include_in_all_words.return_value = True
    sb_info.get_types.return_value = ("ノーマル", "")
    sb_info.rank_to_power.return_value = 1000 # Lethal damage
    
    battle = SingleBattle("p1", "p2", sb_info, p1_max_lives=1, p2_max_lives=1)
    
    # Run the specific action
    action_func(battle)
    
    print(f"Is Finished: {battle.is_finished}")
    print(f"Winner Team: {battle.winner_team}")
    
    # Check P1 perspective
    res1 = battle.get_personalized_response(battle._make_response(), "p1")
    msg1 = next((e["message"] for e in res1["events"] if e["type"] == "battle_result"), "N/A")
    print(f"P1 sees: {msg1}")
    
    # Check P2 perspective
    res2 = battle.get_personalized_response(battle._make_response(), "p2")
    msg2 = next((e["message"] for e in res2["events"] if e["type"] == "battle_result"), "N/A")
    print(f"P2 sees: {msg2}")
    
    # Verification
    if battle.winner_team == 0:
        if "勝った" in msg1 and "負けた" in msg2:
            print("SUCCESS: Perspectives correct.")
        else:
            print("FAILURE: Perspectives incorrect.")
    elif battle.winner_team == 1:
        if "負けた" in msg1 and "勝った" in msg2:
            print("SUCCESS: Perspectives correct.")
        else:
            print("FAILURE: Perspectives incorrect.")

def test_hp_zero():
    def action(battle):
        # P1 attacks P2
        # Ensure it's P1's turn
        if battle.get_current_actor().id != "p1":
            battle.current_turn_index = (battle.current_turn_index + 1) % 2
            
        current = battle.get_current_actor()
        target = battle.player2 if current.id == "p1" else battle.player1
        
        # Set target HP to 1 to ensure even minimum damage kills
        target.hp = 1
        
        # Set starting character to match our word "しりとり"
        battle.character = "し"
        
        print(f"Current Actor: {current.id}, Target: {target.id}, Target HP: {target.hp}")
        
        res = battle.try_attack(current.id, "しりとり")
        if res.get("type") == "error":
            print(f"Attack Error: {res.get('message')}")
        
        print(f"After Attack - Target HP: {target.hp}")
        
    run_win_test("HP Zero (Standard)", action)

def test_timeout():
    def action(battle):
        # Current actor timeouts
        current = battle.get_current_actor()
        print(f"{current.id} timeouts")
        battle.timeout()
        
    run_win_test("Timeout", action)

if __name__ == "__main__":
    test_hp_zero()
    test_timeout()
