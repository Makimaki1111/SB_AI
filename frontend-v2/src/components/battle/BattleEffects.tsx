import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './BattleEffects.module.css';

interface Particle {
  id: number;
  type: 'heal' | 'stat_up' | 'stat_down';
  startX: number; // cqw
  startY: number; // cqw
  driftX: number; // cqw
  driftY: number; // cqw
  scale: number;
}

interface BattleEffectsProps {
  trigger: 'heal' | 'stat_up' | 'stat_down' | 'up' | 'down' | string | null;
}

/**
 * キャラクターの周囲にエフェクトを発生させるコンポーネント
 */
export const BattleEffects: React.FC<BattleEffectsProps> = ({ trigger }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    let type: Particle['type'] | null = null;
    if (trigger === 'heal') type = 'heal';
    else if (trigger === 'stat_up' || trigger === 'up') type = 'stat_up';
    else if (trigger === 'stat_down' || trigger === 'down') type = 'stat_down';

    if (!type) return;

    // 量は多めを維持
    const count = type === 'heal' ? 15 : 12;
    const interval = type === 'heal' ? 60 : 100;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const id = Date.now() + i + Math.random();
        const newParticle: Particle = {
          id: id,
          type: type as Particle['type'],
          // 横幅は広めに散らす (-20cqw ~ 20cqw)
          startX: (Math.random() - 0.5) * 40,
          startY: (Math.random() - 0.5) * 10,
          driftX: (Math.random() - 0.5) * 10,
          // 縦方向の移動を短く抑える (12cqw)
          driftY: type === 'stat_down' ? 12 : -12,
          scale: 0.8 + Math.random() * 0.7,
        };
        setParticles(prev => [...prev, newParticle]);
        
        setTimeout(() => {
          setParticles(prev => prev.filter(p => p.id !== id));
        }, 1300);
      }, i * interval);
    }
  }, [trigger]);

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ 
              opacity: 0, 
              y: `${p.startY}cqw`, 
              scale: p.scale * 0.5, 
              x: `${p.startX}cqw` 
            }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              y: [`${p.startY}cqw`, `${p.startY + p.driftY}cqw`], 
              x: [`${p.startX}cqw`, `${p.startX + p.driftX}cqw`],
              scale: [null, p.scale, p.scale * 1.3] 
            }}
            transition={{ 
              duration: 1.2, 
              times: [0, 0.2, 0.8, 1],
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
