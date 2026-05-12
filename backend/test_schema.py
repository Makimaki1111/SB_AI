import sys
import os

# プロジェクトルートをパスに追加
sys.path.append(os.getcwd())

try:
    from backend.schemas import BattleEvent
    from pydantic import ValidationError

    print("--- Testing BattleEvent Schema ---")
    
    # 1. 従来のイベント形式（新しいフィールドなし）が通るか
    try:
        e1 = BattleEvent(type="damage", message="テスト", target="p1", damage=10, hp=90)
        print("Test 1 (Old format): PASS")
    except ValidationError as e:
        print(f"Test 1 (Old format): FAIL - {e}")

    # 2. 新しいフィールドを含めた形式が通るか
    try:
        e2 = BattleEvent(type="cure_poison", message="なおった", target="p1", new_is_poison=False)
        print("Test 2 (New field): PASS")
        assert e2.new_is_poison is False
    except ValidationError as e:
        print(f"Test 2 (New field): FAIL - {e}")

    # 3. フィールドが足りない場合（必須の type がない場合など）
    try:
        BattleEvent(message="Error Test")
        print("Test 3 (Validation): FAIL (Should have raised error)")
    except ValidationError:
        print("Test 3 (Validation): PASS")

    print("\nAll Backend Schema Tests completed.")

except ImportError as e:
    print(f"Import Error: {e}")
    print("Make sure to run this from the project root.")
