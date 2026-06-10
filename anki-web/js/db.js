/**
 * IndexedDB Storage Layer for Anki-Web
 * Handles all database operations for decks and cards
 */

const DB = {
  DB_NAME: 'anki-web-db',
  DB_VERSION: 1,
  db: null,

  /**
   * Initialize the database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Decks store
        if (!db.objectStoreNames.contains('decks')) {
          const deckStore = db.createObjectStore('decks', { keyPath: 'id' });
          deckStore.createIndex('name', 'name', { unique: false });
          deckStore.createIndex('created', 'created', { unique: false });
        }

        // Cards store
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('deckId', 'deckId', { unique: false });
          cardStore.createIndex('due', 'due', { unique: false });
          cardStore.createIndex('status', 'status', { unique: false });
        }

        // Review log store
        if (!db.objectStoreNames.contains('reviews')) {
          const reviewStore = db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
          reviewStore.createIndex('cardId', 'cardId', { unique: false });
          reviewStore.createIndex('date', 'date', { unique: false });
        }
      };
    });
  },

  // ========== DECK OPERATIONS ==========

  async addDeck(deck) {
    const tx = this.db.transaction('decks', 'readwrite');
    const store = tx.objectStore('decks');
    const newDeck = {
      id: this.generateId(),
      name: deck.name,
      description: deck.description || '',
      icon: deck.icon || '📚',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const request = store.add(newDeck);
      request.onsuccess = () => resolve(newDeck);
      request.onerror = () => reject(request.error);
    });
  },

  async getDeck(id) {
    const tx = this.db.transaction('decks', 'readonly');
    const store = tx.objectStore('decks');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllDecks() {
    const tx = this.db.transaction('decks', 'readonly');
    const store = tx.objectStore('decks');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async updateDeck(id, updates) {
    const deck = await this.getDeck(id);
    if (!deck) throw new Error('Deck not found');
    const updatedDeck = { ...deck, ...updates, updated: new Date().toISOString() };
    const tx = this.db.transaction('decks', 'readwrite');
    const store = tx.objectStore('decks');
    return new Promise((resolve, reject) => {
      const request = store.put(updatedDeck);
      request.onsuccess = () => resolve(updatedDeck);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteDeck(id) {
    // Delete deck and all its cards
    const cards = await this.getCardsByDeck(id);
    const tx = this.db.transaction(['decks', 'cards'], 'readwrite');
    const deckStore = tx.objectStore('decks');
    const cardStore = tx.objectStore('cards');

    deckStore.delete(id);
    cards.forEach(card => cardStore.delete(card.id));

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // ========== CARD OPERATIONS ==========

  async addCard(card) {
    const tx = this.db.transaction('cards', 'readwrite');
    const store = tx.objectStore('cards');
    const newCard = {
      id: this.generateId(),
      deckId: card.deckId,
      front: card.front,
      back: card.back,
      tags: card.tags || [],
      starred: false,
      // SM-2 fields
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      due: null,
      lastReview: null,
      lastQuality: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const request = store.add(newCard);
      request.onsuccess = () => resolve(newCard);
      request.onerror = () => reject(request.error);
    });
  },

  async getCard(id) {
    const tx = this.db.transaction('cards', 'readonly');
    const store = tx.objectStore('cards');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getCardsByDeck(deckId) {
    const tx = this.db.transaction('cards', 'readonly');
    const store = tx.objectStore('cards');
    const index = store.index('deckId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(deckId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async updateCard(id, updates) {
    const card = await this.getCard(id);
    if (!card) throw new Error('Card not found');
    const updatedCard = { ...card, ...updates, updated: new Date().toISOString() };
    const tx = this.db.transaction('cards', 'readwrite');
    const store = tx.objectStore('cards');
    return new Promise((resolve, reject) => {
      const request = store.put(updatedCard);
      request.onsuccess = () => resolve(updatedCard);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteCard(id) {
    const tx = this.db.transaction('cards', 'readwrite');
    const store = tx.objectStore('cards');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getAllCards() {
    const tx = this.db.transaction('cards', 'readonly');
    const store = tx.objectStore('cards');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ========== REVIEW LOG ==========

  async addReview(review) {
    const tx = this.db.transaction('reviews', 'readwrite');
    const store = tx.objectStore('reviews');
    const newReview = {
      ...review,
      date: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const request = store.add(newReview);
      request.onsuccess = () => resolve(newReview);
      request.onerror = () => reject(request.error);
    });
  },

  async getReviewsByDate(dateStr) {
    const tx = this.db.transaction('reviews', 'readonly');
    const store = tx.objectStore('reviews');
    const index = store.index('date');
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);
    const range = IDBKeyRange.bound(start.toISOString(), end.toISOString());
    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllReviews() {
    const tx = this.db.transaction('reviews', 'readonly');
    const store = tx.objectStore('reviews');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ========== IMPORT / EXPORT ==========

  async exportData() {
    const decks = await this.getAllDecks();
    const cards = await this.getAllCards();
    const reviews = await this.getAllReviews();
    return { decks, cards, reviews, exportedAt: new Date().toISOString(), version: '1.0' };
  },

  async importData(data) {
    if (!data.decks || !data.cards) throw new Error('Invalid data format');

    const tx = this.db.transaction(['decks', 'cards', 'reviews'], 'readwrite');
    const deckStore = tx.objectStore('decks');
    const cardStore = tx.objectStore('cards');

    // Clear existing data
    deckStore.clear();
    cardStore.clear();

    // Import decks
    data.decks.forEach(deck => deckStore.put(deck));
    data.cards.forEach(card => cardStore.put(card));

    if (data.reviews) {
      const reviewStore = tx.objectStore('reviews');
      reviewStore.clear();
      data.reviews.forEach(review => reviewStore.put(review));
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAll() {
    const tx = this.db.transaction(['decks', 'cards', 'reviews'], 'readwrite');
    tx.objectStore('decks').clear();
    tx.objectStore('cards').clear();
    tx.objectStore('reviews').clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // ========== UTILITY ==========

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
};