/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo 2 algorithm by P.A. Wozniak
 * 
 * Quality ratings:
 *   1 = Again (complete blackout)
 *   2 = Hard (incorrect, but recalled after seeing answer)
 *   3 = Good (correct with some difficulty)
 *   4 = Easy (perfect recall)
 */

const SM2 = {
  // Default parameters
  DEFAULT_EASE: 2.5,
  MIN_EASE: 1.3,
  GRADUATING_INTERVAL: 1,    // days
  EASY_INTERVAL: 4,           // days
  RELEARNING_STEPS: [10],     // minutes

  /**
   * Calculate the next review schedule based on SM-2 algorithm
   * @param {Object} card - Card object with review data
   * @param {number} quality - Rating 1-4
   * @returns {Object} Updated card with new interval, ease, due date
   */
  calculate(card, quality) {
    const now = new Date();
    let { interval, ease, repetitions, lapses } = card;

    // Initialize defaults
    if (interval === undefined) interval = 0;
    if (ease === undefined) ease = this.DEFAULT_EASE;
    if (repetitions === undefined) repetitions = 0;
    if (lapses === undefined) lapses = 0;

    if (quality === 1) {
      // Again - reset
      interval = 1;
      repetitions = 0;
      lapses += 1;
      ease = Math.max(this.MIN_EASE, ease - 0.2);
    } else if (quality === 2) {
      // Hard
      if (repetitions === 0) {
        interval = 1;
      } else {
        interval = Math.max(1, Math.round(interval * 1.2));
      }
      ease = Math.max(this.MIN_EASE, ease - 0.15);
      repetitions += 1;
    } else if (quality === 3) {
      // Good
      if (repetitions === 0) {
        interval = this.GRADUATING_INTERVAL;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ease);
      }
      // ease stays the same
      repetitions += 1;
    } else if (quality === 4) {
      // Easy
      if (repetitions === 0) {
        interval = this.EASY_INTERVAL;
      } else {
        interval = Math.round(interval * ease * 1.3);
      }
      ease += 0.15;
      repetitions += 1;
    }

    // Calculate due date
    const due = new Date(now);
    due.setDate(due.getDate() + interval);

    return {
      interval,
      ease,
      repetitions,
      lapses,
      due: due.toISOString(),
      lastReview: now.toISOString(),
      lastQuality: quality
    };
  },

  /**
   * Check if a card is due for review
   * @param {Object} card - Card with due date
   * @returns {boolean}
   */
  isDue(card) {
    if (!card.due) return true;
    return new Date(card.due) <= new Date();
  },

  /**
   * Get cards that are due for review in a deck
   * @param {Array} cards - All cards in a deck
   * @returns {Array} Due cards sorted by due date (oldest first)
   */
  getDueCards(cards) {
    return cards
      .filter(card => this.isDue(card))
      .sort((a, b) => {
        if (!a.due) return -1;
        if (!b.due) return 1;
        return new Date(a.due) - new Date(b.due);
      });
  },

  /**
   * Get new cards (never reviewed)
   * @param {Array} cards - All cards
   * @returns {Array}
   */
  getNewCards(cards) {
    return cards.filter(card => !card.lastReview);
  },

  /**
   * Get card status string
   * @param {Object} card
   * @returns {string} 'new' | 'learning' | 'review' | 'relearning'
   */
  getStatus(card) {
    if (!card.lastReview) return 'new';
    if (card.repetitions <= 1) return 'learning';
    if (card.lapses > 0 && card.interval <= 1) return 'relearning';
    return 'review';
  },

  /**
   * Format interval for display
   * @param {number} days
   * @returns {string}
   */
  formatInterval(days) {
    if (days < 1) return '<1d';
    if (days === 1) return '1d';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}y`;
  }
};

// Export for use
if (typeof module !== 'undefined') module.exports = SM2;