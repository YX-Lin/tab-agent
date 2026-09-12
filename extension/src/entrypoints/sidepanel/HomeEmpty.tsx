import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { HomeModel, HomePrompt } from "./homeModel";

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  model: HomeModel;
  composer: ReactNode;
  onPrompt: (prompt: HomePrompt) => void;
  onOpenSettings: () => void;
};

export function HomeEmpty({ model, composer, onPrompt, onOpenSettings }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="chat-home">
      <div className="chat-home-copy">
        <motion.h1
          className="chat-home-title"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: EASE }}
        >
          {model.title}
        </motion.h1>
        <motion.p
          className="chat-home-desc"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0.12 : 0.32,
            delay: reduceMotion ? 0 : 0.04,
            ease: EASE,
          }}
        >
          {model.description}
        </motion.p>
        {model.stats.length ? (
          <div className="chat-home-stats" aria-label="当前窗口概况">
            {model.stats.map((item) => (
              <span key={item.key} className="chat-home-stat">
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
        {model.needsKey ? (
          <button type="button" className="chat-home-setup" onClick={onOpenSettings}>
            去设置填 API Key
          </button>
        ) : null}
      </div>

      <div className="chat-home-composer">{composer}</div>

      <div className="chat-home-prompts" data-count={model.prompts.length}>
        <AnimatePresence>
          {model.prompts.map((item, index) => (
            <motion.button
              key={item.key}
              type="button"
              className="chat-home-prompt"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.24,
                delay: reduceMotion ? 0 : 0.08 + index * 0.04,
                ease: EASE,
              }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              onClick={() => onPrompt(item)}
            >
              <span className="chat-home-prompt-label">{item.label}</span>
              <span className="chat-home-prompt-desc">{item.description}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      <p className="chat-home-hint">页面空白处右键，也可以一键整理这一窗</p>
    </div>
  );
}
