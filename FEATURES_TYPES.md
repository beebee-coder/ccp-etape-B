# NexaFlow — Feature Types Reference

> Généré après introspection Prisma de la base de données existante.
> Chaque feature ci-dessous liste les types métier, les modèles Prisma associés,
> et les champs à utiliser pour les implémentations futures.

---

## 1. Authentification & Autorisation

**Modèles Prisma :** `User`, `Role`

**Types métier :**
```ts
type AuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: Role; // admin | chef_de_bloc | chef_de_quart | user
  approved: boolean;
  image?: string;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

type LoginPayload = {
  username: string;
  password: string;
  callbackUrl?: string;
};

type LoginResponse = {
  token: string;
  csrfToken: string;
  user: Omit<AuthUser, "password">;
  callbackUrl: string | null;
};

type RefreshTokenPayload = {
  token: string;
};
```

**À implémenter :**
- [ ] CRUD complet `User` (inscription, édition, suppression)
- [ ] Endpoint `GET /api/users` avec filtres rôle/approbation
- [ ] Endpoint `PATCH /api/users/:id/approve`
- [ ] Gestion du mot de passe (reset, change)
- [ ] Avatar/image profil

---

## 2. Procédures

**Modèles Prisma :** `Procedure`, `ProcedureStep`, `ProcedureAlarm`, `ProcedureDocument`, `ProcedureExecution`, `ProcedureMedia`, `ProcedureVersion`, `ProcedureFieldTemplate`

**Types métier :**
```ts
type Procedure = {
  id: string;
  code: string;
  title: string;
  description?: string;
  category: string;
  criticality: "NORMAL" | "HIGH" | "CRITICAL";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  prerequisites?: Json;
  steps: Json; // tableau d'étapes
  authorId: string;
  lastExecutedAt?: Date;
  executionCount: number;
  subcategory?: string;
  department?: string;
  version?: string;
  parameters?: Json;
  postExecution?: Json;
  metadata?: Json;
  mediaLibrary?: Json;
  createdAt: Date;
  updatedAt: Date;
};

type ProcedureStep = {
  id: string;
  procedureId: string;
  stepOrder: number;
  stepId: string;
  title: string;
  subtitle?: string;
  instructions: string;
  stepType: string;
  isMandatory: boolean;
  dependencies: string[];
  mediaRequirements: Json;
  alarms: Json;
  attachments: string[];
  timerEnabled: boolean;
  timerSeconds: number;
};

type ProcedureAlarm = {
  id: string;
  procedureId: string;
  code: string;
  type: string;
  severity: string;
  description: string;
  remedy: Json;
  condition: string;
  triggeredAt?: Date;
  resolvedAt?: Date;
  status: "ACTIVE" | "RESOLVED";
};

type ProcedureDocument = {
  id: string;
  procedureId: string;
  title: string;
  type: string;
  url: string;
  caption?: string;
  uploadedBy: string;
  uploadedAt: Date;
};

type ProcedureExecution = {
  id: string;
  procedureId: string;
  operatorId: string;
  startTime: Date;
  endTime?: Date;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ABORTED";
  stepsStatus?: Json;
  totalDuration?: number;
  currentStep?: number;
  alarms?: Json;
  fallbacks?: Json;
  events?: Json;
  signature?: string;
};

type ProcedureMedia = {
  id: string;
  procedureId: string;
  kind: string;
  source: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  createdBy: string;
  createdAt: Date;
};

type ProcedureVersion = {
  id: string;
  procedureId: string;
  version: string;
  changes: string;
  snapshot: Json;
  createdBy: string;
  createdAt: Date;
};

type ProcedureFieldTemplate = {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: Json;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

**À implémenter :**
- [ ] CRUD `Procedure` avec validation Zod
- [ ] CRUD `ProcedureStep` (cascade)
- [ ] CRUD `ProcedureAlarm`
- [ ] CRUD `ProcedureDocument`
- [ ] CRUD `ProcedureMedia`
- [ ] Historique `ProcedureVersion`
- [ ] Exécution `ProcedureExecution` avec signature
- [ ] Templates de champs dynamiques `ProcedureFieldTemplate`

---

## 3. Chat & Messagerie IA

**Modèles Prisma :** `chat_messages`

**Types métier :**
```ts
type ChatMessage = {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string; // groq | gemini | mock
  timestamp: Date;
  media?: Json;
  procedureId?: string;
  source?: string;
  clientId?: string;
};

type ChatConversation = {
  conversationId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};
```

**À implémenter :**
- [ ] CRUD `chat_messages` avec pagination
- [ ] Endpoint `GET /api/chat/:conversationId/history`
- [ ] Endpoint `POST /api/chat/send` (avec streaming SSE)
- [ ] Liaison `procedureId` pour chat contextuel

---

## 4. État des Lieux

**Modèles Prisma :** (pas de modèle dédié, utilise `etat_des_lieux_reports` existant)

**Types métier :**
```ts
type MediaAttachment = {
  kind: "image" | "video";
  dataUrl: string;
  mimeType: string;
  size: number;
  thumbnailDataUrl?: string;
};

type EtatDesLieuxReport = {
  id: string;
  title: string;
  description: string;
  location: string;
  attachments: MediaAttachment[];
  status: "draft" | "sent";
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
};
```

**À implémenter :**
- [ ] Migrer `etat_des_lieux_reports` vers Prisma
- [ ] CRUD complet avec filtres par auteur/statut

---

## 5. Médias / Images

**Modèles Prisma :** `MediaItem` (existant)

**Types métier :**
```ts
type MediaKind = "image" | "video";

type MediaItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  kind: MediaKind;
  mimeType: string;
  size: number;
  dataUrl: string;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

**À implémenter :**
- [ ] Migrer `media_items` vers Prisma
- [ ] CRUD complet avec recherche par tags/catégorie

---

## 6. Base de connaissances

**Modèles Prisma :** `knowledge_items`

**Types métier :**
```ts
type KnowledgeItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  question?: string;
  answer?: string;
  tags: string[];
  category?: string;
  content?: string;
  createdAt: Date;
  updatedAt: Date;
};

type KnowledgeCreatePayload = {
  type: string;
  title: string;
  question?: string;
  answer?: string;
  tags: string[];
  category?: string;
  content?: string;
};
```

**À implémenter :**
- [ ] CRUD `knowledge_items`
- [ ] Endpoint `GET /api/knowledge?category=...&tags=...`
- [ ] Import/export Q/R

---

## 7. Rapports

**Modèles Prisma :** (pas de modèle dédié, à créer)

**Types métier :**
```ts
type ReportPoint = {
  executorName: string;
  zone: string;
  service: string;
  hoursWorked: number;
  text: string;
};

type Report = {
  id: string;
  points: ReportPoint[];
  date: string;
  createdAt: string;
};
```

**À implémenter :**
- [ ] Créer table `reports` (si pas déjà présente)
- [ ] CRUD rapports journaliers
- [ ] Export PDF/TXT

---

## 8. Équipes

**Modèles Prisma :** (pas de modèle dédié, à créer)

**Types métier :**
```ts
type Member = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "away" | "inactive";
  avatar: string;
};

type Team = {
  id: number;
  name: string;
  description: string;
  color: string;
  members: number;
  members_list: Member[];
};
```

**À implémenter :**
- [ ] Créer tables `teams`, `team_members`
- [ ] CRUD équipes et membres
- [ ] Affectation rôles par équipe

---

## 9. Workflows & Exécutions

**Modèles Prisma :** `Workflow`, `WorkflowStep`, `Execution`

**Types métier :**
```ts
type Workflow = {
  id: string;
  userId: string;
  name: string;
  status: "draft" | "published" | "archived";
  triggerType?: string;
  config?: Json;
  steps: WorkflowStep[];
  executions: Execution[];
  createdAt: Date;
  updatedAt: Date;
};

type WorkflowStep = {
  id: string;
  workflowId: string;
  position: number;
  actionType: string;
  config?: Json;
  nextStepId?: string;
};

type Execution = {
  id: string;
  workflowId: string;
  userId: string;
  currentStepId?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
};
```

**À implémenter :**
- [ ] Moteur d'exécution de workflows
- [ ] Éditeur visuel de workflows
- [ ] Historique des exécutions

---

## 10. Système Embarqué / IoT

**Modèles Prisma :** (pas de modèle dédié, à créer)

**Types métier :**
```ts
type SensorReading = {
  deviceId: string;
  timestamp: number;
  camera: { active: boolean; resolution: string; fps: number; motionDetected: boolean };
  microphone: { active: boolean; level: number; noiseDetected: boolean };
  temperature: { active: boolean; current: number; min: number; max: number; unit: "C" | "F"; alert: boolean };
};

type ActuatorState = {
  id: string;
  name: string;
  type: "relay" | "servo" | "led" | "motor" | "valve";
  state: "idle" | "active" | "error";
  enabled: boolean;
};

type DeviceConnectionInfo = {
  type: "cable" | "wireless" | "disconnected";
  status: "connected" | "connecting" | "disconnected";
  rssi?: number;
};
```

**À implémenter :**
- [ ] Tables `devices`, `sensor_readings`, `actuator_states`
- [ ] API SSE pour événements temps réel
- [ ] Stockage historique capteurs

---

## 11. Intégrations

**Modèles Prisma :** `Integration`

**Types métier :**
```ts
type Integration = {
  id: string;
  userId: string;
  service: string; // slack | github | notion | linear | ...
  credentials: Json;
  isActive: boolean;
  createdAt: Date;
};
```

**À implémenter :**
- [ ] CRUD intégrations
- [ ] OAuth flows par service
- [ ] Webhooks entrants

---

## 12. Audit & Logs

**Modèles Prisma :** `AuditLog`

**Types métier :**
```ts
type AuditLog = {
  id: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Json;
  createdAt: Date;
};
```

**À implémenter :**
- [ ] Middleware d'audit automatique sur toutes les routes sensibles
- [ ] Endpoint `GET /api/audit-logs` avec filtres

---

## 13. Pipeline CI/CD

**Modèles Prisma :** (pas de modèle dédié, à créer)

**Types métier :**
```ts
type PipelineRun = {
  id: string;
  branch: string;
  commitMessage: string;
  status: "running" | "success" | "error";
  startedAt: Date;
  finishedAt?: Date;
  logs: string;
};
```

**À implémenter :**
- [ ] Table `pipeline_runs`
- [ ] Historique des déploiements

---

## 14. Vidéoconférence

**Modèles Prisma :** (pas de modèle dédié, à créer)

**Types métier :**
```ts
type Meeting = {
  id: string;
  title: string;
  startedAt: Date;
  endedAt?: Date;
  participants: string[];
  recordingUrl?: string;
};

type ChatMessage = {
  id: string;
  meetingId: string;
  userId: string;
  text: string;
  timestamp: Date;
};
```

**À implémenter :**
- [ ] Intégration WebRTC ou service tiers
- [ ] Enregistrement réunion

---

## 15. Notifications

**Modèles Prisma :** (pas de modèle dédié, à créer)

**Types métier :**
```ts
type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: Date;
};
```

**À implémenter :**
- [ ] Table `notifications`
- [ ] Push notifications (Web Push / Firebase)
- [ ] Email notifications (Resend / SendGrid)

---

## 16. RAG / Recherche Vectorielle

**Modèles Prisma :** `ChromaIndex`

**Types métier :**
```ts
type ChromaIndex = {
  id: string;
  collection: string;
  documentId: string;
  content: string;
  metadata?: Json;
  embedding?: number[]; // vector(384)
  createdAt: Date;
};
```

**À implémenter :**
- [ ] Pipeline d'embeddings (OpenAI / local)
- [ ] Endpoint de recherche sémantique
- [ ] Synchronisation avec ChromaDB

---

## 17. Stockage Fichiers

**Types métier :**
```ts
type FileStorage = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  createdAt: Date;
};
```

**À implémenter :**
- [ ] Migrer les base64 vers Vercel Blob / S3
- [ ] CDN pour les médias

---

## Notes d'implémentation

- Toutes les dates utilisent `DateTime` Prisma (ISO 8601)
- Les champs `Json` acceptent tout objet sérialisable
- Les relations sont typées fortement par Prisma
- Les enums (`Role`) sont gérés nativement
