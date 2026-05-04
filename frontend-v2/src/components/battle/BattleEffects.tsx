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
  trigger: string | null;
  side: 'ally' | 'foe';
}

export const BattleEffects: React.FC<BattleEffectsProps> = ({ trigger, side }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    // 回復、能力変化などの演出をトリガー
    if (['heal', 'stat_up', 'stat_down'].includes(trigger)) {
      const newParticles: Particle[] = Array.from({ length: 5 }).map((_, i) => ({
        id: Date.now() + i,
        type: trigger as any,
        x: Math.random() * 80 - 40, // 散らばり
        y: Math.random() * 40 - 20,
      }));
      setParticles(prev => [...prev, ...newParticles]);
      
      // 1.5秒後に削除
      setTimeout(() => {
        setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
      }, 1500);
    }
  }, [trigger]);

  return (
    <div className={`${styles.container} ${side === 'ally' ? styles.ally : styles.foe}`}>
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: p.type === 'stat_down' ? -20 : 20, scale: 0.5, x: p.x }}
            animate={{ 
              opacity: [0, 1, 0], 
              y: p.type === 'stat_down' ? 60 : -60, 
              scale: 1.2 
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`${styles.particle} ${styles[p.type]}`}
          >
            {p.type === 'heal' ? '+' : p.type === 'stat_up' ? '▲' : '▼'}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
