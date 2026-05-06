import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './BattleEffects.module.css';

interface Particle {
  id: number;
  type: 'heal' | 'stat_up' | 'stat_down';
  x: number;
  y: number;
}

interface BattleEffectsProps {
  trigger: 'heal' | 'stat_up' | 'stat_down' | 'up' | 'down' | string | null;
  side: 'ally' | 'foe';
}

export const BattleEffects: React.FC<BattleEffectsProps> = ({ trigger, side }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    // 回復、能力変化などの演出をトリガー
    if (trigger === 'heal' || trigger === 'stat_up' || trigger === 'stat_down' || trigger === 'up' || trigger === 'down') {
      const type = (trigger === 'up' ? 'stat_up' : trigger === 'down' ? 'stat_down' : trigger) as Particle['type'];
      const count = type === 'heal' ? 15 : 10;
      const interval = type === 'heal' ? 80 : 100;

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const id = Date.now() + i;
          const newParticle: Particle = {
            id: id,
            type: type,
            x: Math.random() * 180 - 90, // 本家: Math.random() * 180 + 20 (コンテナ基準で調整)
            y: type === 'stat_down' ? -40 : 40,
          };
          setParticles(prev => [...prev, newParticle]);
          
          // 1.5秒後に削除
          setTimeout(() => {
            setParticles(prev => prev.filter(p => p.id !== id));
          }, 1500);
        }, i * interval);
      }
    }
  }, [trigger]);

  return (
    <div className={`${styles.container} ${side === 'ally' ? styles.ally : styles.foe}`}>
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ 
              opacity: 0, 
              y: p.type === 'stat_down' ? -20 : 20, 
              scale: 0.5, 
              x: p.x 
            }}
            animate={{ 
              opacity: [0, 1, 1, 0], // 本家の 0->1(20%), 1->0(100%)
              y: p.type === 'stat_down' ? [null, 0, 60] : [null, 0, -60], 
              scale: [0.5, 1, 1.2] 
            }}
            transition={{ 
              duration: 1.5, 
              times: [0, 0.2, 0.2, 1], // 0-20% で出現、100% までに移動
              ease: "easeOut" 
            }}
            className={`${styles.particle} ${styles[p.type]}`}
          >
            {p.type === 'heal' ? '+' : p.type === 'stat_up' ? '▲' : '▼'}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
