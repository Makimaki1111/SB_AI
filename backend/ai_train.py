import torch
import torch.nn as nn
import torch.optim as optim
import time
from torch.utils.data import Dataset, DataLoader

from ai_dl_env import ShiritoriNet, StateEncoder
from ai_self_play import generate_self_play_data
from SB_info import SB_info
from battle import get_default_abilities

class ShiritoriDataset(Dataset):
    def __init__(self, data_list):
        # data_list: List of (state_encoded: np.ndarray, target_policy: np.ndarray, target_value: float)
        self.data_list = data_list

    def __len__(self):
        return len(self.data_list)

    def __getitem__(self, idx):
        state, policy, value = self.data_list[idx]
        return (
            torch.tensor(state, dtype=torch.float32),
            torch.tensor(policy, dtype=torch.float32),
            torch.tensor([value], dtype=torch.float32)
        )

def train_network(net, dataset, epochs=10, batch_size=32, device="cpu"):
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    # 複数タスク用の最適化: Policyは確率分布(CrossEntropy等)、Valueは実数値(-1~1)(MSE等)
    optimizer = optim.Adam(net.parameters(), lr=0.001, weight_decay=1e-4) # 荷重減衰で過学習を防ぐ
    
    val_loss_fn = nn.MSELoss()
    
    net.to(device)
    net.train()
    
    print(f"Starting Training on {device}...")
    for epoch in range(epochs):
        total_loss = 0.0
        total_v_loss = 0.0
        total_p_loss = 0.0
        
        for batch_states, batch_p_targets, batch_v_targets in dataloader:
            batch_states = batch_states.to(device)
            batch_p_targets = batch_p_targets.to(device)
            batch_v_targets = batch_v_targets.to(device)
            
            optimizer.zero_grad()
            
            pol_probs, val = net(batch_states)
            
            # 1. 価値判断 (Value) の損失
            v_loss = val_loss_fn(val, batch_v_targets)
            
            # 2. 手の判断 (Policy) の損失 [- sum(Target * log(Prob))]
            # pol_probsはSoftmaxを通しているので対数をとる (0を防ぐため微小な値を足す)
            p_loss = -torch.sum(batch_p_targets * torch.log(pol_probs + 1e-8)) / batch_states.size(0)
            
            # 合計Loss
            loss = v_loss + p_loss
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            total_v_loss += v_loss.item()
            total_p_loss += p_loss.item()
            
        print(f"Epoch [{epoch+1}/{epochs}] - Loss: {total_loss:.4f} (Val: {total_v_loss:.4f}, Pol: {total_p_loss:.4f})")
        
    return net

def run_training_pipeline():
    # CUDA (NVIDIA GPU) or MPS (Mac M1/M2) or CPU
    device = "cpu"
    if torch.cuda.is_available():
         device = "cuda"
    elif torch.backends.mps.is_available():
         device = "mps"
    print(f"Using device: {device}")

    sb_info = SB_info()
    abilities = get_default_abilities()
    
    # モデルの準備
    net = ShiritoriNet().to(device)
    
    # フェーズ1: 自己対戦データ作成 (数十試合〜数百試合)
    # ※フル学習させるには `num_games=1000` のように増やし、数日かけて回す
    start = time.time()
    data = generate_self_play_data(net, sb_info, abilities, num_games=10, device=device)
    print(f"--- Data Generation Time: {time.time()-start:.1f}s ---\n")
    
    if len(data) == 0:
        print("Error: No data generated.")
        return
        
    # フェーズ2: 生成されたデータセットでニューラルネットを訓練
    dataset = ShiritoriDataset(data)
    start = time.time()
    net = train_network(net, dataset, epochs=20, batch_size=8, device=device)
    print(f"--- Training Time: {time.time()-start:.1f}s ---\n")
    
    # モデルの保存
    model_path = "shiritori_ai_model.pth"
    torch.save(net.state_dict(), model_path)
    print(f"Model saved to {model_path}!")

if __name__ == "__main__":
    run_training_pipeline()
