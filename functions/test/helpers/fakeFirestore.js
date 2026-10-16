/**
 * Minimal in-memory stand-in for the slice of the Admin Firestore API the category routing
 * code uses: doc get/set/update/delete, nested collections, where(==) chains, runTransaction.
 * Not a general emulator; it exists so resolution and seeding can be unit tested offline.
 */

function createFakeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([path, data]) => [path, { ...data }]));

  const snapshot = (path) => {
    const data = store.get(path);
    return {
      id: path.split('/').pop(),
      exists: data !== undefined,
      data: () => (data === undefined ? undefined : { ...data }),
    };
  };

  const listCollection = (collPath) =>
    [...store.keys()]
      .filter((key) => key.startsWith(`${collPath}/`) && !key.slice(collPath.length + 1).includes('/'))
      .map(snapshot);

  const makeQuery = (collPath, filters = [], max = Infinity) => ({
    where: (field, op, value) => {
      if (op !== '==') throw new Error('fake db: only == is supported');
      return makeQuery(collPath, [...filters, [field, value]], max);
    },
    limit: (n) => makeQuery(collPath, filters, n),
    select: () => makeQuery(collPath, filters, max),
    get: async () => {
      const docs = listCollection(collPath)
        .filter((d) => filters.every(([field, value]) => d.data()[field] === value))
        .slice(0, max);
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  });

  const docRef = (path) => ({
    id: path.split('/').pop(),
    path,
    get: async () => snapshot(path),
    set: async (data, options) => {
      store.set(path, options && options.merge ? { ...(store.get(path) || {}), ...data } : { ...data });
    },
    update: async (data) => {
      if (!store.has(path)) throw new Error(`fake db: no document to update at ${path}`);
      store.set(path, { ...store.get(path), ...data });
    },
    delete: async () => {
      store.delete(path);
    },
    collection: (name) => collectionRef(`${path}/${name}`),
  });

  const collectionRef = (collPath) => ({
    ...makeQuery(collPath),
    doc: (id = `auto${store.size + 1}`) => docRef(`${collPath}/${id}`),
  });

  return {
    collection: collectionRef,
    runTransaction: async (fn) =>
      fn({
        get: (target) => target.get(),
        set: (ref, data, options) => ref.set(data, options),
        update: (ref, data) => ref.update(data),
      }),
    /** Test helpers */
    dump(collPath) {
      return Object.fromEntries(listCollection(collPath).map((d) => [d.id, d.data()]));
    },
    patch(path, data) {
      store.set(path, { ...(store.get(path) || {}), ...data });
    },
  };
}

module.exports = { createFakeDb };
