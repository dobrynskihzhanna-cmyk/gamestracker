# Firestore Rules для журнала занятий

Новая вкладка **«Занятия»** хранит записи в коллекции `lesson_records`.

Добавьте следующий блок в Firebase Console → Firestore Database → Rules. Он должен находиться внутри:

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // Вставить блок здесь, рядом с students, games и gameResults.
  }
}
```

Сам блок:

```javascript
match /lesson_records/{recordId} {
  // Только пользователь, чей UID есть в коллекции admins.
  allow read: if request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid));

  allow create: if request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid))
    && request.resource.data.keys().hasOnly([
      'lesson_record_id',
      'student_id',
      'date',
      'lesson_content',
      'lesson_result',
      'support_used',
      'next_step',
      'engagement_state',
      'independence_level',
      'difficulty_type',
      'teacher_observation',
      'private_teacher_note',
      'created_at',
      'updated_at'
    ])
    && request.resource.data.lesson_record_id == recordId
    && request.resource.data.student_id is string
    && exists(/databases/$(database)/documents/students/$(request.resource.data.student_id))
    && request.resource.data.date is string
    && request.resource.data.lesson_content is string
    && request.resource.data.lesson_content.size() > 0
    && request.resource.data.lesson_content.size() <= 2000
    && request.resource.data.lesson_result is string
    && request.resource.data.lesson_result.size() > 0
    && request.resource.data.lesson_result.size() <= 2000
    && request.resource.data.support_used is list
    && request.resource.data.support_used.size() > 0
    && request.resource.data.support_used.size() <= 20
    && request.resource.data.next_step is string
    && request.resource.data.next_step.size() > 0
    && request.resource.data.next_step.size() <= 2000
    && request.resource.data.engagement_state is list
    && request.resource.data.engagement_state.size() <= 20
    && request.resource.data.independence_level is string
    && request.resource.data.independence_level.size() <= 100
    && request.resource.data.difficulty_type is string
    && request.resource.data.difficulty_type.size() <= 150
    && request.resource.data.teacher_observation is string
    && request.resource.data.teacher_observation.size() <= 3000
    && request.resource.data.private_teacher_note is string
    && request.resource.data.private_teacher_note.size() <= 3000
    && request.resource.data.created_at == request.time
    && request.resource.data.updated_at == request.time;

  allow update: if request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid))
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'date',
      'lesson_content',
      'lesson_result',
      'support_used',
      'next_step',
      'engagement_state',
      'independence_level',
      'difficulty_type',
      'teacher_observation',
      'private_teacher_note',
      'updated_at'
    ])
    && request.resource.data.lesson_record_id == resource.data.lesson_record_id
    && request.resource.data.student_id == resource.data.student_id
    && request.resource.data.date is string
    && request.resource.data.lesson_content is string
    && request.resource.data.lesson_content.size() > 0
    && request.resource.data.lesson_content.size() <= 2000
    && request.resource.data.lesson_result is string
    && request.resource.data.lesson_result.size() > 0
    && request.resource.data.lesson_result.size() <= 2000
    && request.resource.data.support_used is list
    && request.resource.data.support_used.size() > 0
    && request.resource.data.support_used.size() <= 20
    && request.resource.data.next_step is string
    && request.resource.data.next_step.size() > 0
    && request.resource.data.next_step.size() <= 2000
    && request.resource.data.engagement_state is list
    && request.resource.data.engagement_state.size() <= 20
    && request.resource.data.independence_level is string
    && request.resource.data.independence_level.size() <= 100
    && request.resource.data.difficulty_type is string
    && request.resource.data.difficulty_type.size() <= 150
    && request.resource.data.teacher_observation is string
    && request.resource.data.teacher_observation.size() <= 3000
    && request.resource.data.private_teacher_note is string
    && request.resource.data.private_teacher_note.size() <= 3000
    && request.resource.data.updated_at == request.time;

  allow delete: if request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}
```

Важно:

- не удаляйте существующие правила `students`, `games`, `gameResults` и `admins`;
- в правилах должен остаться только один блок `match /lesson_records/{recordId}`;
- нажмите **Publish / Опубликовать** после вставки;
- отдельное создание коллекции в Firestore не требуется: она появится после сохранения первого занятия;
- анонимные пользователи и ученические игры не могут читать записи занятий, включая `private_teacher_note`.
