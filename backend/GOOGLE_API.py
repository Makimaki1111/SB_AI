# TODO : タイプが含まれていなかった場合の反復処理

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

import SB_info
DICT = SB_info.SB_info().typed_dict
class GOOGLE_AI:
    def __init__(self):
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        self.model = genai.GenerativeModel()

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
                - タイプは1つまたは2つ割り当てる必要があります。これより多くても少なくてもいけません。
                - 単語のみが入力された場合、タイプのみを出力してください。
                - タイプが2つ割り当てられた場合、半角空白区切りで出力してください。
                - 「ノーマル」はタイプを2つ割り当てる際に使用してはいけません。つまり、「ノーマル」は単タイプ限定で使用されなければいけません。
                - タイプ以外の出力は一切してはいけません。

                出力する前に出力が以上の条件を満たしているか考えてから出力するようにしてください。
                """
            chat = self.model.start_chat(history=[{"role": "user", "parts": [first_prompt]}])
            response = chat.send_message(text).text.split()
            return response
        except:
            # 使えなくなったら元々のタイプ
            ret = DICT[text]
            return ret if ret[1] != "" else [ret[0]]