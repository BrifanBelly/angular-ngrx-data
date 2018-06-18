// Not using marble testing
import { TestBed } from '@angular/core/testing';
import { Action } from '@ngrx/store';
import { Actions } from '@ngrx/effects';

import { Observable, of, merge, Subject, throwError } from 'rxjs';
import { delay, first } from 'rxjs/operators';

import { EntityAction } from '../actions/entity-action';
import { EntityActionFactory } from '../actions/entity-action-factory';
import { EntityOp, OP_ERROR } from '../actions/entity-op';

import { EntityCollectionDataService, EntityDataService } from '../dataservices/entity-data.service';
import { DataServiceError, EntityActionDataServiceError } from '../dataservices/data-service-error';
import { PersistenceResultHandler, DefaultPersistenceResultHandler } from '../dataservices/persistence-result-handler.service';
import { HttpMethods } from '../dataservices/interfaces';

import { EntityEffects } from './entity-effects';

import { Logger } from '../utils/interfaces';
import { Update } from '../utils/ngrx-entity-models';

export class TestEntityDataService {
  dataServiceSpy: any;

  constructor() {
    this.dataServiceSpy = jasmine.createSpyObj('EntityCollectionDataService<Hero>', [
      'add',
      'delete',
      'getAll',
      'getById',
      'getWithQuery',
      'update'
    ]);
  }

  getService() {
    return this.dataServiceSpy;
  }
}

// For AOT
export function getDataService() {
  return new TestEntityDataService();
}

export class Hero {
  id: number;
  name: string;
}

//////// Tests begin ////////

describe('EntityEffects (normal testing)', () => {
  // factory never changes in these tests
  const entityActionFactory = new EntityActionFactory();

  let actions$: Subject<Action>;
  let effects: EntityEffects;
  let logger: Logger;
  let testEntityDataService: TestEntityDataService;

  function expectCompletion(completion: EntityAction) {
    effects.persist$.subscribe(
      result => {
        expect(result).toEqual(completion);
      },
      error => {
        fail(error);
      }
    );
  }

  beforeEach(() => {
    logger = jasmine.createSpyObj('Logger', ['error', 'log', 'warn']);
    actions$ = new Subject<Action>();

    TestBed.configureTestingModule({
      providers: [
        EntityEffects,
        { provide: Actions, useValue: actions$ },
        { provide: EntityActionFactory, useValue: entityActionFactory },
        { provide: EntityDataService, useFactory: getDataService },
        { provide: Logger, useValue: logger },
        {
          provide: PersistenceResultHandler,
          useClass: DefaultPersistenceResultHandler
        }
      ]
    });

    actions$ = TestBed.get(Actions);
    effects = TestBed.get(EntityEffects);
    testEntityDataService = TestBed.get(EntityDataService);
  });

  it('should return a QUERY_ALL_SUCCESS, with the heroes, on success', () => {
    const hero1 = { id: 1, name: 'A' } as Hero;
    const hero2 = { id: 2, name: 'B' } as Hero;
    const heroes = [hero1, hero2];

    const response = of(heroes);
    testEntityDataService.dataServiceSpy.getAll.and.returnValue(response);

    const action = entityActionFactory.create('Hero', EntityOp.QUERY_ALL);
    const completion = entityActionFactory.create('Hero', EntityOp.QUERY_ALL_SUCCESS, heroes);

    actions$.next(action);
    expectCompletion(completion);
  });

  it('should perform QUERY_ALL when dispatch custom tagged action', () => {
    const hero1 = { id: 1, name: 'A' } as Hero;
    const hero2 = { id: 2, name: 'B' } as Hero;
    const heroes = [hero1, hero2];

    const response = of(heroes);
    testEntityDataService.dataServiceSpy.getAll.and.returnValue(response);

    const action = entityActionFactory.create({
      entityName: 'Hero',
      op: EntityOp.QUERY_ALL,
      tag: 'Custom Hero Tag'
    });

    const completion = entityActionFactory.createFromAction(action, { op: EntityOp.QUERY_ALL_SUCCESS, data: heroes });

    actions$.next(action);
    expectCompletion(completion);
  });

  it('should perform QUERY_ALL when dispatch properly marked, custom action', () => {
    const hero1 = { id: 1, name: 'A' } as Hero;
    const hero2 = { id: 2, name: 'B' } as Hero;
    const heroes = [hero1, hero2];

    const response = of(heroes);
    testEntityDataService.dataServiceSpy.getAll.and.returnValue(response);

    const action = {
      type: 'some/arbitrary/type/text',
      payload: {
        entityName: 'Hero',
        op: EntityOp.QUERY_ALL
      }
    };

    const completion = entityActionFactory.createFromAction(action, { op: EntityOp.QUERY_ALL_SUCCESS, data: heroes });

    actions$.next(action);
    expectCompletion(completion);
  });

  it('should return a QUERY_ALL_ERROR when service fails', () => {
    const action = entityActionFactory.create('Hero', EntityOp.QUERY_ALL);
    const httpError = { error: new Error('Test Failure'), status: 501 };
    const completion = makeEntityErrorCompletion(action, 'GET', httpError);
    const error = completion.payload.error;

    actions$.next(action);
    const response = throwError(error);
    testEntityDataService.dataServiceSpy.getAll.and.returnValue(response);

    expectCompletion(completion);
    expect(completion.payload.op).toEqual(EntityOp.QUERY_ALL_ERROR);
  });

  it('should return a QUERY_BY_KEY_SUCCESS with a hero on success', () => {
    const action = entityActionFactory.create('Hero', EntityOp.QUERY_BY_KEY, 42);
    const completion = entityActionFactory.create('Hero', EntityOp.QUERY_BY_KEY_SUCCESS);

    actions$.next(action);
    const response = of(undefined);
    testEntityDataService.dataServiceSpy.getById.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a QUERY_BY_KEY_ERROR when service fails', () => {
    const action = entityActionFactory.create('Hero', EntityOp.QUERY_BY_KEY, 42);
    const httpError = { error: new Error('Entity not found'), status: 404 };
    const completion = makeEntityErrorCompletion(action, 'DELETE', httpError);
    const error = completion.payload.error;

    actions$.next(action);
    const response = throwError(error);
    testEntityDataService.dataServiceSpy.getById.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a QUERY_MANY_SUCCESS with selected heroes on success', () => {
    const hero1 = { id: 1, name: 'BA' } as Hero;
    const hero2 = { id: 2, name: 'BB' } as Hero;
    const heroes = [hero1, hero2];

    const action = entityActionFactory.create('Hero', EntityOp.QUERY_MANY, {
      name: 'B'
    });
    const completion = entityActionFactory.create('Hero', EntityOp.QUERY_MANY_SUCCESS, heroes);

    actions$.next(action);
    const response = of(heroes);
    testEntityDataService.dataServiceSpy.getWithQuery.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a QUERY_MANY_ERROR when service fails', () => {
    const action = entityActionFactory.create('Hero', EntityOp.QUERY_MANY, {
      name: 'B'
    });
    const httpError = { error: new Error('Resource not found'), status: 404 };
    const completion = makeEntityErrorCompletion(action, 'GET', httpError);

    actions$.next(action);
    const response = throwError(httpError);
    testEntityDataService.dataServiceSpy.getWithQuery.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_ADD_SUCCESS with the hero on success', () => {
    const hero = { id: 1, name: 'A' } as Hero;

    const action = entityActionFactory.create('Hero', EntityOp.SAVE_ADD_ONE, hero);
    const completion = entityActionFactory.create('Hero', EntityOp.SAVE_ADD_ONE_SUCCESS, hero);

    actions$.next(action);
    const response = of(hero);
    testEntityDataService.dataServiceSpy.add.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_ADD_ERROR when service fails', () => {
    const hero = { id: 1, name: 'A' } as Hero;
    const action = entityActionFactory.create('Hero', EntityOp.SAVE_ADD_ONE, hero);
    const httpError = { error: new Error('Test Failure'), status: 501 };
    const completion = makeEntityErrorCompletion(action, 'PUT', httpError);
    const error = completion.payload.error;

    actions$.next(action);
    const response = throwError(error);
    testEntityDataService.dataServiceSpy.add.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_DELETE_SUCCESS on success', () => {
    const action = entityActionFactory.create('Hero', EntityOp.SAVE_DELETE_ONE, 42);
    const completion = entityActionFactory.create('Hero', EntityOp.SAVE_DELETE_ONE_SUCCESS, 42);

    actions$.next(action);
    const response = of(42); // dataservice successful delete returns the deleted entity id
    testEntityDataService.dataServiceSpy.delete.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_DELETE_ERROR when service fails', () => {
    const action = entityActionFactory.create('Hero', EntityOp.SAVE_DELETE_ONE, 42);
    const httpError = { error: new Error('Test Failure'), status: 501 };
    const completion = makeEntityErrorCompletion(action, 'DELETE', httpError);
    const error = completion.payload.error;

    actions$.next(action);
    const response = throwError(error);
    testEntityDataService.dataServiceSpy.delete.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_UPDATE_SUCCESS with the hero on success', () => {
    const update = { id: 1, changes: { id: 1, name: 'A' } } as Update<Hero>;

    const action = entityActionFactory.create('Hero', EntityOp.SAVE_UPDATE_ONE, update);
    const completion = entityActionFactory.create('Hero', EntityOp.SAVE_UPDATE_ONE_SUCCESS, update);

    actions$.next(action);
    const response = of(update);
    testEntityDataService.dataServiceSpy.update.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_UPDATE_ERROR when service fails', () => {
    const update = { id: 1, changes: { id: 1, name: 'A' } } as Update<Hero>;
    const action = entityActionFactory.create('Hero', EntityOp.SAVE_UPDATE_ONE, update);
    const httpError = { error: new Error('Test Failure'), status: 501 };
    const completion = makeEntityErrorCompletion(action, 'PUT', httpError);
    const error = completion.payload.error;

    actions$.next(action);
    const response = throwError(error);
    testEntityDataService.dataServiceSpy.update.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_ADD_ONE_SUCCESS and isOptimistic with the hero on success', () => {
    const hero = { id: 1, name: 'A' } as Hero;

    const action = entityActionFactory.create('Hero', EntityOp.SAVE_ADD_ONE, hero, { isOptimistic: true });
    const completion = entityActionFactory.create('Hero', EntityOp.SAVE_ADD_ONE_SUCCESS, hero, { isOptimistic: true });

    actions$.next(action);
    const response = of(hero);
    testEntityDataService.dataServiceSpy.add.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_DELETE_ONE_SUCCESS and isOptimistic on success with delete id', () => {
    const action = entityActionFactory.create('Hero', EntityOp.SAVE_DELETE_ONE, 42, { isOptimistic: true });
    const completion = entityActionFactory.create('Hero', EntityOp.SAVE_DELETE_ONE_SUCCESS, 42, { isOptimistic: true });

    actions$.next(action);
    const response = of(undefined);
    testEntityDataService.dataServiceSpy.delete.and.returnValue(response);

    expectCompletion(completion);
  });

  it('should return a SAVE_UPDATE_ONE_SUCCESS and isOptimistic with the hero on success', () => {
    const update = { id: 1, changes: { id: 1, name: 'A' } } as Update<Hero>;

    const action = entityActionFactory.create('Hero', EntityOp.SAVE_UPDATE_ONE, update, { isOptimistic: true });
    const completion = entityActionFactory.create('Hero', EntityOp.SAVE_UPDATE_ONE_SUCCESS, update, { isOptimistic: true });

    actions$.next(action);
    const response = of(update);
    testEntityDataService.dataServiceSpy.update.and.returnValue(response);

    expectCompletion(completion);
  });

  it(`should not do anything with an irrelevant action`, (done: DoneFn) => {
    // Would clear the cached collection
    const action = entityActionFactory.create('Hero', EntityOp.REMOVE_ALL);

    actions$.next(action);
    const sentinel = 'no persist$ effect';

    merge(
      effects.persist$,
      of(sentinel).pipe(delay(1))
      // of(entityActionFactory.create('Hero', EntityOp.QUERY_ALL)) // will cause test to fail
    )
      .pipe(first())
      .subscribe(
        result => expect(result).toEqual(sentinel),
        err => {
          fail(err);
          done();
        },
        done
      );
  });
});

/** Make an EntityDataService error */
function makeEntityErrorCompletion(
  /** The action that initiated the data service call */
  originalAction: EntityAction,
  /** Http method for that action */
  method: HttpMethods,
  /** Http error from the web api */
  httpError: any
) {
  // Error from the web api
  const url = httpError.url || 'api/heroes';

  // Error produced by the EntityDataService
  const error = new DataServiceError(httpError, { method, url, options: originalAction.payload.data });

  const errOp = <EntityOp>(originalAction.payload.op + OP_ERROR);

  // Entity Error Action
  const eaFactory = new EntityActionFactory();
  return eaFactory.create<EntityActionDataServiceError>({
    entityName: 'Hero',
    op: errOp,
    data: { originalAction, error }
  });
}
