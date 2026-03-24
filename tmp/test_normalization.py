import sys
import os

# backend ディレクトリをパスに追加
sys.path.append(os.path.abspath('backend'))

from battle import Battle_info

def test_normalization():
    # インスタンス化せずにメソッドを直接呼び出す（selfをNoneとして渡す）
    # または Battle_info.katakana_to_hiragana(None, "リンゴ")
    
    test_cases = [
        ("リンゴ", "りんご"),
        ("しりとり", "しりとり"),
        ("バナナ", "ばなな"),
        ("カレーライス", "かれーらいす"),
        ("ッ", "っ"),
        ("ァ", "ぁ"),
        ("カキクケコ", "かきくけこ"),
    ]
    
    for katakana, expected in test_cases:
        # katakana_to_hiragana は self を受け取るが、内部で self を使用していないため None で呼べる
        result = Battle_info.katakana_to_hiragana(None, katakana)
        print(f"[{katakana}] -> [{result}] (Expected: {expected})")
        assert result == expected

if __name__ == "__main__":
    test_normalization()
    print("Test passed!")
