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

SB_info()