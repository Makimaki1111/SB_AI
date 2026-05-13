import React from 'react';
import styles from './BattleOverlay.module.css'; // スタイルは共通で利用
import { motion, AnimatePresence } from 'framer-motion';
import { TYPE_TO_IMAGE } from '../../constants/game';
import type { NotificationData } from '../../hooks/battle/useBattleDisplay';

interface BattleNotificationProps {
  notification: NotificationData | null;
}

export const BattleNotification: React.FC<BattleNotificationProps> = ({
  notification,
}) => {
  return (
    <AnimatePresence>
      {notification && (
        <motion.div 
          className={styles.topNotification}
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className={styles.notificationGlow} />
          <div className={styles.notificationContent}>
            {notification.type === 'ability_change' ? (
              <div className={styles.abilityChangeLayout}>
                <div className={styles.playerName}>{notification.playerName}</div>
                <div className={styles.abilityFlow}>
                  {notification.prevAbility && (
                    <div className={styles.abilityIconBox}>
                      <img 
                        src={`/img/${TYPE_TO_IMAGE[notification.prevAbility.icon_type] || 'normal'}.gif`} 
                        alt="" 
                      />
                      <span>{notification.prevAbility.name}</span>
                    </div>
                  )}
                  <div className={styles.arrow}>→</div>
                  {notification.nextAbility && (
                    <div className={styles.abilityIconBox}>
                      <img 
                        src={`/img/${TYPE_TO_IMAGE[notification.nextAbility.icon_type] || 'normal'}.gif`} 
                        alt="" 
                      />
                      <span className={styles.newName}>{notification.nextAbility.name}</span>
                    </div>
                  )}
                </div>
                <div className={styles.notificationText}>{notification.text}</div>
              </div>
            ) : (
              <div className={styles.generalNotification}>
                {notification.text}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
