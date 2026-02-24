import subprocess
import base64
import os

def generate_silent_mp3_base64():
    filename = "silent_0_1s.mp3"
    output_file = "silent_mp3_js.txt"
    
    # 1. ffmpegコマンドを使って0.1秒の無音MP3ファイルを生成
    try:
        # ffmpeg-pythonではなく標準のsubprocessを使用することで、
        # ライブラリのインストール状況（ffmpeg vs ffmpeg-python）に左右されずに実行できます。
        subprocess.run([
            "ffmpeg",
            "-y", # 上書き許可
            "-f", "lavfi", # 入力フォーマット
            "-i", "anullsrc=r=44100:cl=mono", # 入力ソース
            "-t", "0.1", # 時間
            "-acodec", "libmp3lame", # コーデック
            "-q:a", "9", # 品質
            filename
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        print(f"{filename} を作成しました。")
        
    except FileNotFoundError:
        print("エラー: ffmpegが見つかりませんでした。ffmpegをインストールするか、手動でsilent.mp3を用意してください。")
        return
    except subprocess.CalledProcessError:
        print("エラー: MP3の生成に失敗しました。")
        return

    # 2. ファイルを読み込んでBase64エンコード
    if os.path.exists(filename):
        with open(filename, "rb") as f:
            binary_data = f.read()
            base64_data = base64.b64encode(binary_data).decode('utf-8')
            
            # Data URI Scheme形式で出力
            result = f"data:audio/mp3;base64,{base64_data}"
            
            # コンソールに出力すると長すぎるため、ファイルに保存する
            with open(output_file, "w", encoding="utf-8") as out_f:
                out_f.write(f'const SILENT_MP3_BASE64 = "{result}";')

            print(f"\n成功！ Base64データを {output_file} に保存しました。")
            print("このファイルの中身を script.js にコピペしてください。")
            
        # 後始末（ファイルを削除したい場合）
        # os.remove(filename)

if __name__ == "__main__":
    generate_silent_mp3_base64()
