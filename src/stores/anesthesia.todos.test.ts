import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAnesthesiaStore } from '@/stores/anesthesia';

describe('anesthesia store todos', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('权威病例缺少计划时间时不补造日期且不阻断页面渲染', () => {
    const store = useAnesthesiaStore();
    const target = store.cases.find((item) => item.urgency === '择期' && !item.preVisit.completed)
      ?? store.cases[0];
    expect(target).toBeTruthy();
    target.urgency = '择期';
    target.preVisit.completed = false;
    target.plannedStart = '';

    const todo = store.todos.find((item) => item.id === `todo-pre-${target.id}`);

    expect(todo).toBeTruthy();
    expect(todo?.dueTime).toBeUndefined();
  });
});
