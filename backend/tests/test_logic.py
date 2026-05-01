import sys
import os

# backend/tests/test_logic.py から見て 2 つ上のディレクトリがプロジェクトルート
current_file_path = os.path.abspath(__file__)
tests_dir = os.path.dirname(current_file_path)
backend_dir = os.path.dirname(tests_dir)
project_root = os.path.dirname(backend_dir)

sys.path.insert(0, project_root)

try:
    from backend.battle import Battle_info
    from backend.SB_info import SB_info
    print("SUCCESS: Imports successful")
except Exception as e:
    print(f"ERROR: Import failed: {e}")
    sys.exit(1)

def test_battle_logic():
    print("Starting Battle Logic Test...")
    sb_info = SB_info()
    battle = Battle_info("p1", "p2", sb_info)
    
    print(f"Initial character: {battle.character}")
    
    word_candidates = sb_info.get_typed_word_candidates(battle.character)
    if not word_candidates:
        print("WARNING: No candidates found for initial character, using fallback")
        word = battle.character + "あ"
    else:
        word = word_candidates[0]
    
    print(f"Testing valid word: {word}")
    # validate_word は (norm_word, error) を返すようになった
    norm_word, error = battle.validate_word(word)
    if error:
        print(f"FAILED: Validation failed for valid word: {error}")
    else:
        print(f"SUCCESS: Validation passed for valid word (Normalized: {norm_word})")
        
    battle.record_used_word(norm_word or word, "p1")
    print(f"Next character after '{norm_word or word}': {battle.character}")
    
    wrong_word = "あ" if battle.character != "あ" else "い"
    _, error = battle.validate_word(wrong_word)
    if error and "はじまることばを入力してください" in error["message"]:
        print("SUCCESS: Correctly rejected word with wrong initial character")
    else:
        print(f"FAILED: Failed to reject word with wrong initial character: {error}")

    print("Battle Logic Test Completed.")

if __name__ == "__main__":
    test_battle_logic()
