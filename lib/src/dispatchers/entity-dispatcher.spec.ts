import { Action } from '@ngrx/store';

import { DefaultDispatcherOptions } from './default-dispatcher-options';
import { defaultSelectId } from '../utils/utilities';
import { EntityAction } from '../actions/entity-action';
import { EntityActionFactory } from '../actions/entity-action-factory';
import { EntityCommands } from './entity-commands';
import { EntityDispatcher } from './entity-dispatcher';
import { EntityDispatcherBase } from './entity-dispatcher-base';
import { EntityDispatcherFactory } from './entity-dispatcher-factory';
import { EntityOp } from '../actions/entity-op';
import { MergeStrategy } from '../actions/merge-strategy';
import { Update } from '../utils/ngrx-entity-models';

class Hero {
  id: number;
  name: string;
  saying?: string;
}

/** Store stub */
class TestStore {
  dispatch() {}
}

const defaultDispatcherOptions = new DefaultDispatcherOptions();

describe('EntityDispatcher', () => {
  commandDispatchTest(entityDispatcherTestSetup);

  function entityDispatcherTestSetup() {
    // only interested in calls to store.dispatch()
    const store: any = new TestStore();
    const selectId = defaultSelectId;
    const entityActionFactory = new EntityActionFactory();
    const dispatcher = new EntityDispatcherBase<Hero>(
      'Hero',
      entityActionFactory,
      store,
      selectId,
      defaultDispatcherOptions,
      null, // scannedActions$ not used in these tests
      null // entityCacheSelector not used in these tests
    );
    return { dispatcher, store };
  }
});

///// Tests /////

/**
 * Test that implementer of EntityCommands dispatches properly
 * @param setup Function that sets up the EntityDispatcher before each test (called in a BeforeEach()).
 */
export function commandDispatchTest(setup: () => { dispatcher: EntityDispatcher<Hero>; store: any }) {
  let dispatcher: EntityDispatcher<Hero>;
  let testStore: { dispatch: jasmine.Spy };

  function dispatchedAction() {
    return <EntityAction>testStore.dispatch.calls.argsFor(0)[0];
  }

  beforeEach(() => {
    const s = setup();
    spyOn(s.store, 'dispatch').and.callThrough();
    dispatcher = s.dispatcher;
    testStore = s.store;
  });

  it('#entityName is the expected name of the entity type', () => {
    expect(dispatcher.entityName).toBe('Hero');
  });

  describe('Save actions', () => {
    // By default add and update are pessimistic and delete is optimistic.
    // Tests override in the dispatcher method calls as necessary.

    describe('(optimistic)', () => {
      it('#add(hero) can dispatch SAVE_ADD_ONE optimistically', () => {
        const hero: Hero = { id: 42, name: 'test' };
        dispatcher.add(hero, { isOptimistic: true });
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_ADD_ONE);
        expect(isOptimistic).toBe(true);
        expect(data).toBe(hero);
      });

      it('#delete(42) dispatches SAVE_DELETE_ONE optimistically for the id:42', () => {
        dispatcher.delete(42); // optimistic by default
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_DELETE_ONE);
        expect(isOptimistic).toBe(true);
        expect(data).toBe(42);
      });

      it('#delete(hero) dispatches SAVE_DELETE_ONE optimistically for the hero.id', () => {
        const id = 42;
        const hero: Hero = { id, name: 'test' };
        dispatcher.delete(hero); // optimistic by default
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_DELETE_ONE);
        expect(isOptimistic).toBe(true);
        expect(data).toBe(42);
      });

      it('#update(hero) can dispatch SAVE_UPDATE_ONE optimistically with an update payload', () => {
        const hero: Hero = { id: 42, name: 'test' };
        const expectedUpdate: Update<Hero> = { id: 42, changes: hero };

        dispatcher.update(hero, { isOptimistic: true });
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_UPDATE_ONE);
        expect(isOptimistic).toBe(true);
        expect(data).toBe(expectedUpdate);
      });
    });

    describe('(pessimistic)', () => {
      it('#add(hero) dispatches SAVE_ADD pessimistically', () => {
        const hero: Hero = { id: 42, name: 'test' };
        dispatcher.add(hero); // pessimistic by default
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_ADD_ONE);
        expect(isOptimistic).toBe(false);
        expect(data).toBe(hero);
      });

      it('#delete(42) can dispatch SAVE_DELETE pessimistically for the id:42', () => {
        dispatcher.delete(42, { isOptimistic: false }); // optimistic by default
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_DELETE_ONE);
        expect(isOptimistic).toBe(false);
        expect(data).toBe(42);
      });

      it('#delete(hero) can dispatch SAVE_DELETE pessimistically for the hero.id', () => {
        const id = 42;
        const hero: Hero = { id, name: 'test' };

        dispatcher.delete(hero, { isOptimistic: false }); // optimistic by default
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_DELETE_ONE);
        expect(isOptimistic).toBe(false);
        expect(data).toBe(42);
      });

      it('#update(hero) dispatches SAVE_UPDATE with an update payload', () => {
        const hero: Hero = { id: 42, name: 'test' };
        const expectedUpdate: Update<Hero> = { id: 42, changes: hero };

        dispatcher.update(hero); // pessimistic by default
        const { op, isOptimistic, data } = dispatchedAction().payload;
        expect(op).toBe(EntityOp.SAVE_UPDATE_ONE);
        expect(isOptimistic).toBe(false);
        expect(data).toBe(expectedUpdate);
      });
    });
  });

  describe('Query actions', () => {
    it('#getAll() dispatches QUERY_ALL with PreserveChanges', () => {
      dispatcher.getAll();

      const { op, entityName, mergeStrategy } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.QUERY_ALL);
      expect(entityName).toBe('Hero');
      expect(mergeStrategy).toBe(MergeStrategy.PreserveChanges);
    });

    it('#getByKey(42) dispatches QUERY_BY_KEY for the id:42 with PreserveChanges', () => {
      dispatcher.getByKey(42);

      const { op, data, mergeStrategy } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.QUERY_BY_KEY);
      expect(data).toBe(42);
      expect(mergeStrategy).toBe(MergeStrategy.PreserveChanges);
    });

    it('#getWithQuery(QueryParams) dispatches QUERY_MANY with PreserveChanges', () => {
      dispatcher.getWithQuery({ name: 'B' });

      const { op, data, entityName, mergeStrategy } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.QUERY_MANY);
      expect(entityName).toBe('Hero');
      expect(data).toEqual({ name: 'B' }, 'params');
      expect(mergeStrategy).toBe(MergeStrategy.PreserveChanges);
    });

    it('#getWithQuery(string) dispatches QUERY_MANY with PreserveChanges', () => {
      dispatcher.getWithQuery('name=B');

      const { op, data, entityName, mergeStrategy } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.QUERY_MANY);
      expect(entityName).toBe('Hero');
      expect(data).toEqual('name=B', 'params');
      expect(mergeStrategy).toBe(MergeStrategy.PreserveChanges);
    });

    it('#load() dispatches QUERY_LOAD', () => {
      dispatcher.load();

      const { op, entityName } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.QUERY_LOAD);
      expect(entityName).toBe('Hero');
    });
  });

  /*** Cache-only operations ***/
  describe('Cache-only actions', () => {
    it('#addAllToCache dispatches ADD_ALL', () => {
      const heroes: Hero[] = [{ id: 42, name: 'test 42' }, { id: 84, name: 'test 84', saying: 'howdy' }];
      dispatcher.addAllToCache(heroes);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.ADD_ALL);
      expect(data).toBe(heroes);
    });

    it('#addOneToCache dispatches ADD_ONE', () => {
      const hero: Hero = { id: 42, name: 'test' };
      dispatcher.addOneToCache(hero);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.ADD_ONE);
      expect(data).toBe(hero);
    });

    it('#addManyToCache dispatches ADD_MANY', () => {
      const heroes: Hero[] = [{ id: 42, name: 'test 42' }, { id: 84, name: 'test 84', saying: 'howdy' }];
      dispatcher.addManyToCache(heroes);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.ADD_MANY);
      expect(data).toBe(heroes);
    });

    it('#clearCache() dispatches REMOVE_ALL for the Hero collection', () => {
      dispatcher.clearCache();
      const { op, entityName } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.REMOVE_ALL);
      expect(entityName).toBe('Hero');
    });

    it('#removeOneFromCache(key) dispatches REMOVE_ONE', () => {
      const id = 42;
      dispatcher.removeOneFromCache(id);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.REMOVE_ONE);
      expect(data).toBe(id);
    });

    it('#removeOneFromCache(entity) dispatches REMOVE_ONE', () => {
      const id = 42;
      const hero: Hero = { id, name: 'test' };
      dispatcher.removeOneFromCache(hero);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.REMOVE_ONE);
      expect(data).toBe(id);
    });

    it('#removeManyFromCache(keys) dispatches REMOVE_MANY', () => {
      const keys = [42, 84];
      dispatcher.removeManyFromCache(keys);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.REMOVE_MANY);
      expect(data).toBe(keys);
    });

    it('#removeManyFromCache(entities) dispatches REMOVE_MANY', () => {
      const heroes: Hero[] = [{ id: 42, name: 'test 42' }, { id: 84, name: 'test 84', saying: 'howdy' }];
      const keys = heroes.map(h => h.id);
      dispatcher.removeManyFromCache(heroes);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.REMOVE_MANY);
      expect(data).toEqual(keys);
    });

    it('#toUpdate() helper method creates Update<T>', () => {
      const hero: Partial<Hero> = { id: 42, name: 'test' };
      const expected = { id: 42, changes: hero };
      const update = dispatcher.toUpdate(hero);
      expect(update).toEqual(expected);
    });

    it('#updateOneInCache dispatches UPDATE_ONE', () => {
      const hero: Partial<Hero> = { id: 42, name: 'test' };
      const update = { id: 42, changes: hero };
      dispatcher.updateOneInCache(hero);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.UPDATE_ONE);
      expect(data).toEqual(update);
    });

    it('#updateManyInCache dispatches UPDATE_MANY', () => {
      const heroes: Partial<Hero>[] = [{ id: 42, name: 'test 42' }, { id: 84, saying: 'ho ho ho' }];
      const updates = [{ id: 42, changes: heroes[0] }, { id: 84, changes: heroes[1] }];
      dispatcher.updateManyInCache(heroes);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.UPDATE_MANY);
      expect(data).toEqual(updates);
    });

    it('#upsertOneInCache dispatches UPSERT_ONE', () => {
      const hero: Partial<Hero> = { id: 42, name: 'test' };
      const upsert = { id: 42, changes: hero };
      dispatcher.upsertOneInCache(hero);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.UPSERT_ONE);
      expect(data).toEqual(upsert);
    });

    it('#upsertManyInCache dispatches UPSERT_MANY', () => {
      const heroes: Partial<Hero>[] = [{ id: 42, name: 'test 42' }, { id: 84, saying: 'ho ho ho' }];
      const upserts = [{ id: 42, changes: heroes[0] }, { id: 84, changes: heroes[1] }];
      dispatcher.upsertManyInCache(heroes);
      const { op, data } = dispatchedAction().payload;
      expect(op).toBe(EntityOp.UPSERT_MANY);
      expect(data).toEqual(upserts);
    });
  });
}
