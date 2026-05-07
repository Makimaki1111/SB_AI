
import sys
import os

# backendディレクトリをパスに追加
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from battle import SingleBattle
from double_battle import DoubleBattle
from SB_info import SB_info
from unittest.mock import MagicMock

def test_handshake_and_personalization():
    print("=== Testing Handshake and Personalization ===")
    
    # Mock SB_info
    sb_info = MagicMock(spec=SB_info)
    sb_info.get_next_initial.return_value = "い"
    sb_info.rank_to_power.return_value = 1.0
    
    # 1. Single Battle Test (1-life behavior)
    print("\n[1] Single Battle Test (1-life)")
    battle = SingleBattle("user1", "user2", sb_info, p1_max_lives=1, p2_max_lives=1)
    
    # User 1 takes fatal damage
    battle.player1.hp = 0
    battle._check_win_condition()
    
    print(f"P1 lives: {battle.player1.lives}") # Should be 0
    print(f"P1 hp: {battle.player1.hp}") # Should be 0
    print(f"Winner: {battle.winner_team}") # Should be 1 (P2 won)
    print(f"Event types: {[e['type'] for e in battle.events]}") # Should include battle_result
    
    # Simulate broadcast: get base_response ONCE
    base_res = battle._make_response()
    
    # Player 1's perspective
    res1 = battle.get_personalized_response(base_res, "user1")
    state1 = res1["state"]
    print(f"P1 Turn: {state1['is_my_turn']}") # Should be True if user1 is actor
    print(f"P1 ally_max_lives: {state1['ally_max_lives']}") # Should be 2
    print(f"P1 mapping: {res1['info']['id_to_ui_map']}") # Should be {user1: ally, user2: foe}
    print(f"P1 message: {res1['events'][0]['message']}") # Should be "相手に 10 のダメージ！"
    
    # Player 2's perspective
    res2 = battle.get_personalized_response(base_res, "user2")
    state2 = res2["state"]
    print(f"P2 Turn: {state2['is_my_turn']}") # Should be False
    print(f"P2 foe_max_lives: {state2['foe_max_lives']}") # Should be 2
    print(f"P2 mapping: {res2['info']['id_to_ui_map']}") # Should be {user2: ally, user1: foe}
    print(f"P2 message: {res2['events'][0]['message']}") # Should be "あなたは 10 のダメージ！" (Personalized)
    
    # 2. Double Battle Test
    print("\n[2] Double Battle Test")
    # team1 owns p1a, p1b. team2 owns p2a, p2b.
    db = DoubleBattle("1v1_double", ["user1"], ["user2"], sb_info)
    db.events = [
        {"type": "damage", "message": "相手に 5 のダメージ！", "target": "p2a", "attacker": "p1a"},
        {"type": "ability_changed", "target": "p2b", "new_ability": "mukimuki"}
    ]
    
    # Simulate broadcast
    base_db_res = db._make_response()

    # User 1's perspective
    res_db1 = db.get_personalized_response(base_db_res, "user1")
    state_db1 = res_db1["state"]
    print(f"DB P1 mapping: {res_db1['info']['id_to_ui_map']}") # Should have ally_a, foe_a etc
    print(f"DB P1 P2a Owner: {state_db1['characters']['p2a']['owner_id']}") # Should be "opponent"
    print(f"DB P1 P2a Ability: {state_db1['characters']['p2a']['ability']}") # Should be "secret"
    print(f"DB P1 Event Count: {len(res_db1['events'])}") # Should be 1 (ability_changed masked)
    print(f"DB P1 Damage Msg: {res_db1['events'][0]['message']}") # "相手に 5 のダメージ！"
    
    # User 2's perspective
    res_db2 = db.get_personalized_response(base_db_res, "user2")
    print(f"DB P2 Damage Msg: {res_db2['events'][0]['message']}") # "あなたは 5 のダメージ！"
    print(f"DB P2 P2b Ability: {res_db2['state']['characters']['p2b']['ability']}") # Should be NOT "secret" (own char)
    print(f"DB P2 Event Count: {len(res_db2['events'])}") # Should be 2 (can see own ability change)

    print("\n=== Test Finished ===")

if __name__ == "__main__":
    test_handshake_and_personalization()
