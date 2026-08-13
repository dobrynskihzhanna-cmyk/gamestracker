# Разрешение администратору добавлять учеников

Новая форма создаёт документы `students/{studentId}` непосредственно из административного трекера. Для этого Firestore Rules должны разрешать подтверждённому администратору операцию `create`.

В существующих правилах найдите блок:

```text
match /students/{studentId}
```

Сохраните существующее правило чтения и добавьте разрешение создания. Если в правилах уже есть функция `isAdmin()`, рекомендуемый блок выглядит так:

```javascript
match /students/{studentId} {
  allow read: if isAdmin();

  allow create: if isAdmin()
    && request.resource.data.keys().hasOnly([
      'studentId',
      'displayName',
      'active',
      'createdAt',
      'notes'
    ])
    && request.resource.data.keys().hasAll([
      'studentId',
      'displayName',
      'active',
      'createdAt'
    ])
    && request.resource.data.studentId == studentId
    && studentId.matches('^s[0-9]{3,}$')
    && request.resource.data.displayName is string
    && request.resource.data.displayName.size() > 0
    && request.resource.data.displayName.size() <= 100
    && request.resource.data.active == true
    && request.resource.data.createdAt == request.time
    && (!request.resource.data.keys().hasAny(['notes'])
        || (request.resource.data.notes is string
            && request.resource.data.notes.size() <= 500));

  allow update, delete: if false;
}
```

Важно:

- не создавайте вторую функцию `isAdmin()`, если она уже есть;
- не удаляйте остальные правила для `games`, `gameResults` и `admins`;
- после изменения нажмите **Publish** в Firebase Console;
- если администратору уже разрешены все операции через общее правило `allow write: if isAdmin()`, дополнительное разрешение может не понадобиться, но более узкое правило выше безопаснее.

## Разрешение администратору изменять настройки игр

Чтобы кнопка **Изменить** могла сохранять название, URL и статус игры, добавьте или обновите блок `games`:

```javascript
match /games/{gameId} {
  allow read: if isAdmin();

  allow update: if isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'title',
      'url',
      'active'
    ])
    && request.resource.data.title is string
    && request.resource.data.title.size() > 0
    && request.resource.data.title.size() <= 100
    && request.resource.data.url is string
    && request.resource.data.url.size() > 0
    && request.resource.data.url.size() <= 500
    && request.resource.data.active is bool;

  allow create, delete: if false;
}
```

Это правило не разрешает менять `gameId` и остальные поля документа.
