import csv
from collections import defaultdict


class SB_info:
    def __init__(self):
        self.all_dict = defaultdict(set) # self.all_dict[頭文字] = set(単語一覧)の辞書
        self.typed_dict = defaultdict(lambda:("","")) # 単語のタイプを返す辞書

        with open("C:/Users/Excus/AppData/Local/Programs/Python/Python311/Lib/site-packages/SB_tools/dic/notype.csv", 'r', encoding='utf-8-sig') as typed_file:
                reader = csv.reader(typed_file)
                typed_words_not_processing = list(reader)
        for i in typed_words_not_processing:
            word = i[0]
            self.all_dict[word[0]].add(word) 
       
        with open("C:/Users/Excus/AppData/Local/Programs/Python/Python311/Lib/site-packages/SB_tools/dic/typed.csv", 'r', encoding='utf-8-sig') as typed_file:
                reader = csv.reader(typed_file)
                typed_words_not_processing = list(reader)
        for i in typed_words_not_processing:
            #1個目:言葉、2個目:タイプ1、3個目:タイプ2
            word,*types = i[0].split()
            if(len(types) == 1):types.append("")
            self.typed_dict[word] = tuple(types)
        
    def include_in_all_words(self,word:str):
        """
            入力した単語が辞書に含まれているか判別します
        """
        return word in self.all_dict[word[0]]
    
    def inclue_in_typed_words(self,word):
        """
            入力した単語がタイプ付き単語として登録されているか判定します
        """
        return word in self.typed_dict
    
    def image_name(self,type_name):
        d = {
             "暴力" : "violence",
             "食べ物" : "food",
             "地名" : "place",
             "社会" : "society",
             "動物" : "animal",
             "感情" : "emote",
             "植物" : "plant",
             "理科" : "science",
             "遊び" : "play",
             "人物" : "person",
             "服飾" : "cloth",
             "工作" : "work",
             "芸術" : "art",
             "人体" : "body",
             "時間" : "time",
             "機械" : "mech",
             "医療" : "health",
             "物語" : "tale",
             "暴言" : "insult",
             "数学" : "math",
             "天気" : "weather",
             "虫" : "bug",
             "宗教" : "religion",
             "スポーツ" : "sports",
             "ノーマル" : "normal",
        }
        return d[type_name] if type_name in d else ""