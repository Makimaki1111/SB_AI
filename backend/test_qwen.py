import os
import sys

# モジュール検索パスの設定
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from GOOGLE_API import AI_Client

def main():
    print("=== AI Type Check Test (Groq) ===")
    print("Make sure GROQ_API_KEY is set.")
    
    # AIインスタンスの生成
    try:
        ai = AI_Client()
        print(f"Model: {ai.model_name}")
    except Exception as e:
        print(f"Initialization Error: {e}")
        return

    # テストする単語リスト
    test_words = [
        "りんご",   # 期待: 食べ物 (植物)
        "東京",     # 期待: 地名
        "戦車",     # 期待: 機械 暴力
        "サッカー", # 期待: スポーツ
        "楽しい",   # 期待: 感情
        "ドラえもん" # 期待: 機械 人物 (物語) など
    ]

    print("\n--- Testing Words ---")
    for word in test_words:
        print(f"\nInput: {word}")
        try:
            # タイプ判定実行
            types = ai.get_type(word)
            print(f"Output: {types}")
            
        except Exception as e:
            print(f"Error processing '{word}': {e}")

    print("\n=== Test Finished ===")

if __name__ == "__main__":
    main()