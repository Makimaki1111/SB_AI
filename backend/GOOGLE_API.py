# TODO : タイプが含まれていなかった場合の反復処理

import os
#from groq import Groq
import SB_info

DICT = SB_info.SB_info().typed_dict

class AI_Client:
    def __init__(self):
        # 環境変数からAPIキーを取得することを推奨
        self.api_key = os.getenv("GROQ_API_KEY")
        #self.client = Groq(api_key=self.api_key)
        # Groqで使えるモデル (gemma2-9b-it, llama-3.1-8b-instant など)
        self.model_name = "gemma2-9b-it"

    def get_type(self,text:str) -> list:
        """
            AIにタイプ登録をさせる

            返り値:
                d["type1"] = ""
                d["type2"] = "" :dict
        """

        try:
            first_prompt = """
                入力された単語に対してその意味に即したタイプを割り当ててください。詳しい条件は以下の通りです。
                # 条件
                - タイプには「暴力」「食べ物」「地名」「社会」「動物」「感情」「植物」「理科」「遊び」「人物」「服飾」「工作」「芸術」「人体」「時間」「機械」「医療」「物語」「暴言」「数学」「天気」「虫」「宗教」「スポーツ」「ノーマル」の25個があります。これ以外のタイプを独自に作成して出力してはいけません。
                - タイプは基本2つ,少なくとも1つ割り当てる必要があります。これより多くても少なくてもいけません。
                - 単語のみが入力された場合、タイプのみを出力してください。
                - タイプが2つ割り当てられた場合、半角空白区切りで出力してください。
                - 「ノーマル」はタイプを2つ割り当てる際に使用してはいけません。つまり、「ノーマル」は単タイプ限定で使用されなければいけません。
                - タイプ以外の出力は一切してはいけません。

                出力する前に出力が以上の条件を満たしているか考えてから出力するようにしてください。
                """
            
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "user", "content": first_prompt},
                    {"role": "assistant", "content": "はい、理解しました。単語を入力してください。"},
                    {"role": "user", "content": text}
                ],
                model=self.model_name,
                temperature=0.0, # 毎回同じ結果を返すようにする
            )
            
            result = chat_completion.choices[0].message.content
            return result.split()
        except Exception as e:
            print(f"AI Error: {e}")
            # 使えなくなったら元々のタイプ
            ret = DICT[text]
            return ret if ret[1] != "" else [ret[0]]