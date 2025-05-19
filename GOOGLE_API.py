import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

class GOOGLE_AI:
    def __init__(self):
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        self.model = genai.GenerativeModel()

        first_prompt = """
            入力された単語に対してその意味に即したタイプを割り当ててください。詳しい条件は以下の通りです。
            ・タイプには「暴力」「食べ物」「地名」「社会」「動物」「感情」「植物」「理科」「遊び」「人物」「服飾」「工作」「芸術」「人体」「時間」「機械」「医療」「物語」「暴言」「数学」「天気」「虫」「宗教」「スポーツ」「ノーマル」の25個があります。これ以外のタイプを独自に作成して出力してはいけません。
            ・タイプは少なくとも1つ、多くとも2つ割り当てる必要があります。
            ・単語のみが入力された場合タイプのみを出力してください。
            ・タイプが2つ割り当てられた場合、半角空白区切りで出力してください。
            ・タイプ以外の出力は一切してはいけません。
            """
        self.chat = self.model.start_chat(history=[{"role": "user", "parts": [first_prompt]}])

    def get_type(self,text:str):
        """
            AIにタイプ登録をさせる

            返り値:
                [タイプ1,(存在すれば)タイプ2]:list
        """
        response = self.chat.send_message(text)
        return response.text.split()