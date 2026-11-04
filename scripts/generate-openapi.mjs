import { API_OPERATIONS, API_SCOPES } from "../lib/api-catalog.ts";
import { writeFileSync } from "node:fs";
const ref = (name) => ({ $ref: `#/components/schemas/${name}` }),
  str = (maxLength = 255) => ({ type: "string", maxLength }),
  bool = { type: "boolean" },
  id = str(100),
  ids = { type: "array", items: id, maxItems: 100, uniqueItems: true },
  color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const schemas = {
  Error: {
    type: "object",
    required: ["success", "error"],
    properties: { success: { const: false }, error: str(2000) },
  },
  User: {
    type: "object",
    properties: { _id: id, username: str(32), name: str(32) },
  },
  Attachment: {
    type: "object",
    required: ["name", "url", "mimeType"],
    properties: { name: str(255), url: str(2048), mimeType: str(150) },
  },
  ListInput: {
    type: "object",
    required: ["title", "slug"],
    properties: {
      title: { ...str(200), minLength: 1 },
      slug: { ...str(63), pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
      subdomain: {
        ...str(63),
        description: "Nome sotto BASE_DOMAIN; univoco, vuoto per disabilitare.",
      },
      iconType: {
        enum: ["emoji", "fontawesome", "image"],
        default: "fontawesome",
      },
      iconValue: { ...str(2048), default: "fa-solid fa-list-check" },
      members: { ...ids, default: [] },
      aiContext: str(8000),
      accentColor: { ...color, default: "#b94406" },
      backgroundColor: { ...color, default: "#ffffff" },
      faviconUrl: str(2048),
    },
  },
  TaskInput: {
    type: "object",
    required: ["listId", "title"],
    properties: {
      listId: id,
      parentTaskId: { type: ["string", "null"], default: null },
      title: { ...str(500), minLength: 1 },
      description: str(64000),
      assignedTo: ids,
      dueDate: {
        type: ["string", "null"],
        description: "Data ISO o YYYY-MM-DD",
      },
      isFavorite: bool,
      attachments: { type: "array", items: ref("Attachment"), maxItems: 30 },
      tags: ids,
    },
  },
  TagInput: {
    type: "object",
    required: ["listId", "name", "color"],
    properties: { listId: id, name: { ...str(60), minLength: 1 }, color },
  },
  AuthSettings: {
    type: "object",
    additionalProperties: false,
    properties: {
      credentials: bool,
      google: bool,
      discord: bool,
      cognito: bool,
      registration: bool,
    },
  },
};
const metadata = {
  _id: id,
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
};
schemas.List = {
  allOf: [
    ref("ListInput"),
    {
      type: "object",
      properties: {
        ...metadata,
        createdBy: id,
        order: { type: "integer" },
        openTaskCount: { type: "integer" },
      },
    },
  ],
};
schemas.Task = {
  allOf: [
    ref("TaskInput"),
    {
      type: "object",
      properties: {
        ...metadata,
        createdBy: { type: ["string", "null"] },
        order: { type: "integer" },
        isCompleted: bool,
        completedAt: { type: ["string", "null"], format: "date-time" },
        completedBy: { type: ["string", "null"] },
        childCount: { type: "integer" },
        subtaskCount: { type: "integer" },
        subtaskDoneCount: { type: "integer" },
        assignedToUsers: { type: "array", items: ref("User") },
        createdByUser: ref("User"),
        completedByUser: ref("User"),
      },
    },
  ],
};
schemas.Tag = {
  allOf: [
    ref("TagInput"),
    {
      type: "object",
      properties: { ...metadata, createdBy: { type: ["string", "null"] } },
    },
  ],
};
const paths = {},
  response = (data) => ({
    description: "Operazione completata",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data"],
          properties: { success: { const: true }, data },
        },
      },
    },
  }),
  array = (name) => ({ type: "array", items: ref(name) }),
  object = { type: "object" },
  body = (schema) => ({
    required: true,
    content: { "application/json": { schema } },
  });
function add(
  path,
  method,
  summary,
  {
    input,
    output = object,
    status = "200",
    query = [],
    publicRoute = false,
    description = "",
  } = {},
) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: id,
  }));
  parameters.push(
    ...query.map(([name, required = false, description = ""]) => ({
      name,
      in: "query",
      required,
      schema: { type: "string" },
      description,
    })),
  );
  if (method !== "get")
    parameters.push({
      name: "Origin",
      in: "header",
      required: true,
      schema: { type: "string", format: "uri" },
      description:
        "Stessa origine pubblica della richiesta, obbligatoria anche con sessione valida.",
    });
  paths[path] ??= {};
  paths[path][method] = {
    summary,
    description,
    operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
    security: publicRoute ? [] : [{ sessionCookie: [] }],
    ...(parameters.length ? { parameters } : {}),
    ...(input ? { requestBody: body(input) } : {}),
    responses: {
      [status]: response(output),
      ...Object.fromEntries(
        ["400", "401", "403", "404", "409", "429", "500"].map((s) => [
          s,
          {
            description: {
              400: "Input non valido",
              401: "Accedi per continuare",
              403: "Operazione non consentita",
              404: "Risorsa non trovata o non accessibile",
              409: "Conflitto",
              429: "Troppi tentativi",
              500: "Errore interno",
            }[s],
            content: { "application/json": { schema: ref("Error") } },
          },
        ]),
      ),
    },
  };
}
add("/api/public", "get", "Configurazione pubblica", { publicRoute: true });
add("/api/health", "get", "Stato del servizio", {
  publicRoute: true,
  description:
    "Risposta diretta {status,service}, senza envelope success/data.",
});
add("/api/caddy/ask", "get", "Autorizza certificato TLS", {
  publicRoute: true,
  query: [["domain", true]],
  description:
    "Risposta text/plain, 200 solo per host canonico o sottodominio assegnato; altrimenti 403.",
});
const accountInputs = {
  register: {
    type: "object",
    required: ["username", "email", "password"],
    properties: {
      username: str(32),
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 12, maxLength: 72 },
    },
  },
  forgot: {
    type: "object",
    required: ["email"],
    properties: { email: { type: "string", format: "email" } },
  },
  resend: {
    type: "object",
    required: ["email"],
    properties: { email: { type: "string", format: "email" } },
  },
  reset: {
    type: "object",
    required: ["token", "password"],
    properties: {
      token: str(128),
      password: { type: "string", minLength: 12, maxLength: 72 },
    },
  },
  verify: {
    type: "object",
    required: ["token"],
    properties: { token: str(128) },
  },
  password: {
    type: "object",
    required: ["currentPassword", "password"],
    properties: {
      currentPassword: str(72),
      password: { type: "string", minLength: 12, maxLength: 72 },
    },
  },
  link: {
    type: "object",
    required: ["provider"],
    properties: { provider: { enum: ["google", "discord", "cognito"] } },
  },
};
for (const [action, input] of Object.entries(accountInputs))
  add(`/api/account/${action}`, "post", `Account: ${action}`, {
    input,
    publicRoute: !["password", "link"].includes(action),
    status: action === "register" ? "201" : "200",
  });
add("/api/admin/settings", "get", "Impostazioni amministratore");
add("/api/admin/settings", "patch", "Aggiorna metodi di accesso", {
  input: ref("AuthSettings"),
});
add("/api/admin/users", "get", "Membri o ricerca esatta utente", {
  query: [
    ["listId"],
    ["q", false, "Username o email completi. Non espone email nei risultati."],
  ],
  output: array("User"),
});
add("/api/admin/todo/lists", "get", "Liste di cui sei proprietario o membro", {
  output: array("List"),
});
add("/api/admin/todo/lists", "post", "Crea lista privata", {
  input: ref("ListInput"),
  output: ref("List"),
  status: "201",
});
add("/api/admin/todo/lists/{id}", "patch", "Modifica lista (proprietario)", {
  input: { ...schemas.ListInput, required: [] },
  output: ref("List"),
});
add(
  "/api/admin/todo/lists/{id}",
  "delete",
  "Elimina lista e contenuti (proprietario)",
);
add(
  "/api/admin/todo/lists/{id}/clear",
  "delete",
  "Elimina attività attive e discendenti (proprietario)",
);
add("/api/admin/todo/lists/{id}/caddy", "get", "Scarica configurazione Caddy", {
  query: [["target", false, "standalone oppure docker"]],
  output: { type: "object", properties: { content: str(4000) } },
});
add("/api/admin/todo/tasks", "get", "Attività della lista", {
  query: [
    ["listId", true],
    ["parentTaskId", false, "null per radici, oppure ID padre"],
    ["favorites"],
    ["completed"],
    ["tags", false, "ID separati da virgola, filtro AND"],
  ],
  output: array("Task"),
});
add("/api/admin/todo/tasks", "post", "Crea attività", {
  input: ref("TaskInput"),
  output: ref("Task"),
  status: "201",
});
add("/api/admin/todo/tasks/{id}", "get", "Dettaglio attività", {
  output: ref("Task"),
});
const patchTask = {
  ...schemas.TaskInput,
  required: [],
  properties: Object.fromEntries(
    Object.entries(schemas.TaskInput.properties).filter(
      ([k]) => !["listId", "parentTaskId"].includes(k),
    ),
  ),
};
add(
  "/api/admin/todo/tasks/{id}",
  "patch",
  "Modifica attività senza spostarla di lista o padre",
  { input: patchTask, output: ref("Task") },
);
add("/api/admin/todo/tasks/{id}", "delete", "Elimina attività e discendenti");
for (const action of ["complete", "reopen", "favorite"])
  add(
    `/api/admin/todo/tasks/{id}/${action}`,
    "patch",
    `Stato attività: ${action}`,
    { output: ref("Task") },
  );
add(
  "/api/admin/todo/tasks/reorder",
  "post",
  "Riordina atomicamente attività della stessa lista",
  {
    input: {
      type: "object",
      required: ["ids"],
      properties: {
        ids: {
          type: "array",
          minItems: 1,
          maxItems: 1000,
          uniqueItems: true,
          items: id,
        },
      },
    },
  },
);
add(
  "/api/admin/todo/tasks/{id}/attachments",
  "post",
  "Aggiungi allegato accessibile nella lista",
  { input: ref("Attachment"), output: ref("Task") },
);
add(
  "/api/admin/todo/tasks/{id}/attachments",
  "delete",
  "Rimuovi riferimento allegato",
  { query: [["url", true]], output: ref("Task") },
);
add("/api/admin/todo/tags", "get", "Tag della lista", {
  query: [["listId", true]],
  output: array("Tag"),
});
add("/api/admin/todo/tags", "post", "Crea tag", {
  input: ref("TagInput"),
  output: ref("Tag"),
  status: "201",
});
add("/api/admin/todo/tags/{id}", "patch", "Modifica tag", {
  input: { type: "object", properties: { name: str(60), color } },
  output: ref("Tag"),
});
add(
  "/api/admin/todo/tags/{id}",
  "delete",
  "Elimina tag e riferimenti nelle attività",
);
add(
  "/api/admin/todo/ai-generate",
  "post",
  "Genera proposta con assistente facoltativo",
  {
    input: {
      type: "object",
      required: ["listId", "prompt"],
      properties: {
        listId: id,
        prompt: str(8000),
        parentTaskId: { type: ["string", "null"] },
        currentTitle: str(500),
        currentDescription: str(64000),
      },
    },
    description:
      "503 se non configurato. Risposta diretta {title,description,subtasks?}, senza envelope.",
  },
);
add(
  "/api/admin/todo/tasks/{id}/ai-refactor",
  "post",
  "Riformula attività tramite servizio AI configurato",
  {
    input: {
      type: "object",
      properties: {
        type: { enum: ["both", "title", "description"] },
        includeSubtasks: bool,
        generateSubtasks: bool,
      },
    },
    output: ref("Task"),
    description:
      "Modifica titolo/descrizione; può aggiungere sottoattività. 503 se non configurato.",
  },
);
add("/api/admin/upload", "post", "Carica file privato (max 10 MiB)", {
  status: "201",
  description: "Risposta diretta {success:true,url}, senza data.",
});
paths["/api/admin/upload"].post.requestBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: {
        type: "object",
        required: ["file"],
        properties: { file: { type: "string", format: "binary" }, listId: id },
      },
    },
  },
};
add("/api/files/{id}", "get", "Download con controllo accesso", {
  description:
    "File privato a proprietario/membri. Le immagini raster scelte esplicitamente come branding sono pubbliche. Risposta binaria, non JSON.",
});
paths["/api/files/{id}"].get.security = [{ sessionCookie: [] }, {}];
paths["/api/files/{id}"].get.responses["200"] = {
  description: "Contenuto file, con Content-Disposition sicuro",
  content: {
    "application/octet-stream": {
      schema: { type: "string", format: "binary" },
    },
    "image/png": { schema: { type: "string", format: "binary" } },
  },
};
paths["/api/caddy/ask"].get.responses = {
  200: {
    description: "Host autorizzato",
    content: { "text/plain": { schema: { type: "string", const: "allowed" } } },
  },
  403: { description: "Host non assegnato" },
};
paths["/api/health"].get.responses = {
  200: {
    description: "Servizio e database disponibili",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            status: { const: "ok" },
            service: { const: "ErvisioTodo" },
          },
        },
      },
    },
  },
  503: { description: "Database indisponibile" },
};
paths["/api/admin/upload"].post.responses["201"] = {
  description: "File caricato",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: { success: { const: true }, url: str(2048) },
      },
    },
  },
};
paths["/api/admin/todo/ai-generate"].post.responses["200"] = {
  description: "Proposta AI",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["title", "description"],
        properties: {
          title: str(500),
          description: str(64000),
          subtasks: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              properties: { title: str(500), description: str(64000) },
            },
          },
        },
      },
    },
  },
};
for (const p of [
  "/api/admin/todo/ai-generate",
  "/api/admin/todo/tasks/{id}/ai-refactor",
])
  paths[p].post.responses["503"] = {
    description: "Assistente non configurato",
    content: { "application/json": { schema: ref("Error") } },
  };
// Projects, effective workspace policy, personal API tokens and public read-only shares.
schemas.ListInput.properties.projectId = {
  type: ["string", "null"],
  default: null,
  description:
    "Contenitore progetto. I membri del progetto ereditano accesso alla lista.",
};
schemas.TaskInput.properties.description.maxLength = 2000000;
schemas.TaskInput.properties.attachments.maxItems = 1000;
schemas.ProjectInput = {
  type: "object",
  required: ["title", "slug"],
  properties: {
    title: str(200),
    slug: { ...str(63), pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
    description: str(4000),
    iconValue: str(64),
    color,
    members: ids,
  },
};
schemas.Project = {
  allOf: [
    ref("ProjectInput"),
    {
      type: "object",
      properties: {
        ...metadata,
        createdBy: id,
        listCount: { type: "integer" },
        activeTaskCount: { type: "integer" },
      },
    },
  ],
};
const workspaceProperties = {
  siteName: { ...str(60), minLength: 1 },
  defaultLocale: { enum: ["it", "en"] },
  uploadMaxMb: { type: ["number", "null"], minimum: 0 },
  storageQuotaGb: { type: ["number", "null"], minimum: 0 },
  ...Object.fromEntries(
    ["userQuotaGb", "editorMaxMb", "maxShareLifetimeHours"].map((k) => [
      k,
      { type: "number", minimum: 0 },
    ]),
  ),
  ...Object.fromEntries(
    [
      "maxFilesPerUpload",
      "maxAttachmentsPerTask",
      "writeRequestsPerMinute",
      "statsRetentionDays",
      "apiRequestsPerMinute",
    ].map((k) => [k, { type: "integer", minimum: 0 }]),
  ),
  ...Object.fromEntries(
    ["sharingEnabled", "apiEnabled", "membersCanCreateTokens"].map((k) => [
      k,
      bool,
    ]),
  ),
  defaultTokenLifetimeDays: { type: "integer", minimum: 1 },
  maxTokenLifetimeDays: { type: "integer", minimum: 1 },
};
schemas.WorkspaceSettings = {
  type: "object",
  properties: workspaceProperties,
  description:
    "null usa l’ambiente per upload/spazio; 0 rimuove il limite applicativo dove previsto. I controlli sono applicati dal server.",
};
Object.assign(schemas.AuthSettings.properties, workspaceProperties);
add("/api/admin/todo/projects", "get", "Progetti accessibili", {
  output: array("Project"),
});
add("/api/admin/todo/projects", "post", "Crea progetto", {
  input: ref("ProjectInput"),
  output: ref("Project"),
  status: "201",
});
add(
  "/api/admin/todo/projects/{id}",
  "patch",
  "Modifica progetto (proprietario)",
  { input: { ...schemas.ProjectInput, required: [] }, output: ref("Project") },
);
add(
  "/api/admin/todo/projects/{id}",
  "delete",
  "Elimina contenitore conservando liste e attività",
);
paths["/api/admin/todo/lists"].get.parameters ??= [];
paths["/api/admin/todo/lists"].get.parameters.push({
  name: "projectId",
  in: "query",
  schema: { type: "string" },
  description: "ID progetto oppure none per liste senza progetto.",
});
paths["/api/admin/todo/tasks"].get.parameters.push({
  name: "q",
  in: "query",
  schema: { type: "string" },
  description:
    "Ricerca titolo/descrizione: conserva gli antenati per mostrare i rami corrispondenti.",
});
add("/api/admin/tokens", "get", "Metadati token personali");
add(
  "/api/admin/tokens",
  "post",
  "Crea token personale; solo sessione browser",
  {
    input: {
      type: "object",
      required: ["name"],
      properties: {
        name: str(80),
        scopes: {
          type: "array",
          minItems: 1,
          items: { enum: ["read", "write"] },
        },
        lifetimeDays: { type: "integer", minimum: 1 },
      },
    },
    status: "201",
    description:
      "Valore evt_ in chiaro solo in questa risposta. Permessi limitati alle risorse dell’utente. Scadenza conforme alle impostazioni.",
  },
);
add(
  "/api/admin/tokens/{id}",
  "delete",
  "Revoca token personale; solo sessione browser",
);
add("/api/admin/usage", "get", "Utilizzo allegati e quote effettive");
add(
  "/api/admin/activity",
  "get",
  "Registro attività amministrativo soggetto a conservazione",
);
add(
  "/api/admin/todo/lists/{id}/shares",
  "get",
  "Link pubblici della lista (proprietario)",
);
add(
  "/api/admin/todo/lists/{id}/shares",
  "post",
  "Crea link pubblico in sola lettura",
  {
    input: {
      type: "object",
      properties: {
        lifetimeHours: {
          type: "number",
          minimum: 0,
          maximum: 87600,
          default: 24,
        },
      },
    },
    status: "201",
    description:
      "Il token compare soltanto alla creazione. La durata massima configurata può accorciare quella richiesta. Gli allegati e i dati personali dei membri non sono esposti.",
  },
);
add(
  "/api/admin/todo/lists/{id}/shares/{shareId}",
  "delete",
  "Revoca link pubblico",
);
add("/api/shared/{token}", "get", "Lista pubblica in sola lettura", {
  publicRoute: true,
  description:
    "404 se disabilitata, scaduta, revocata o se il creatore non può più gestire la lista. Nessun allegato o dato dei membri.",
});
for (const [path, methods] of Object.entries(paths))
  for (const [method, operation] of Object.entries(methods))
    if (
      path.startsWith("/api/admin/") &&
      !(path.startsWith("/api/admin/tokens") && method !== "get")
    ) {
      operation.security = [{ sessionCookie: [] }, { bearerToken: [] }];
      for (const parameter of operation.parameters || [])
        if (parameter.name === "Origin") {
          parameter.required = false;
          parameter.description =
            "Obbligatorio e same-origin con cookie; non richiesto per Bearer autenticato.";
        }
    }
paths["/api/files/{id}"].get.security = [
  { sessionCookie: [] },
  { bearerToken: [] },
  {},
];
paths["/api/admin/upload"].post.requestBody.content[
  "multipart/form-data"
].schema.properties.files = {
  type: "array",
  items: { type: "string", format: "binary" },
  description: "Caricamento multiplo. Il campo file singolo rimane supportato.",
};
paths["/api/admin/upload"].post.requestBody.content[
  "multipart/form-data"
].schema.required = [];
paths["/api/admin/upload"].post.requestBody.description =
  "Almeno un file o files; dimensioni, numero e quota sono controllati atomicamente.";
paths["/api/admin/upload"].post.responses["201"].content[
  "application/json"
].schema.properties.files = { type: "array", items: ref("Attachment") };
paths["/api/admin/upload"].post.summary =
  "Carica allegati privati con quota e limiti effettivi";
paths["/api/admin/upload"].post.responses["413"] = {
  description: "Dimensione, quota o limite tecnico della richiesta superati",
  content: { "application/json": { schema: ref("Error") } },
};
paths["/api/account/link"].post.responses["200"] = {
  description:
    "Intento monouso di collegamento creato tramite cookie HTTP-only",
  content: {
    "application/json": {
      schema: { type: "object", properties: { success: { const: true } } },
    },
  },
};

// Versioned public integration contract, generated from the route catalog.
const v1Bodies = {
  login: {
    type: "object",
    required: ["login", "password"],
    properties: {
      login: str(254),
      password: str(72),
      name: str(80),
      lifetimeDays: { type: "integer", minimum: 1 },
    },
  },
  register: accountInputs.register,
  email: accountInputs.forgot,
  reset: accountInputs.reset,
  verify: accountInputs.verify,
  password: {
    type: "object",
    required: ["currentPassword", "password"],
    properties: {
      currentPassword: str(72),
      password: { type: "string", minLength: 12, maxLength: 72 },
    },
  },
  project: ref("ProjectInput"),
  projectPatch: { ...schemas.ProjectInput, required: [] },
  list: ref("ListInput"),
  listPatch: { ...schemas.ListInput, required: [] },
  task: ref("TaskInput"),
  taskPatch: {
    ...schemas.TaskInput,
    required: [],
    properties: Object.fromEntries(
      Object.entries(schemas.TaskInput.properties).filter(
        ([key]) => !["listId", "parentTaskId"].includes(key),
      ),
    ),
  },
  tag: ref("TagInput"),
  tagPatch: { type: "object", properties: { name: str(60), color } },
  members: {
    type: "object",
    required: ["members"],
    properties: { members: ids },
  },
  move: {
    type: "object",
    required: ["listId"],
    properties: {
      listId: id,
      parentTaskId: { type: ["string", "null"], default: null },
    },
  },
  reorder: {
    type: "object",
    required: ["ids"],
    properties: { ids: { ...ids, maxItems: 1000 } },
  },
  bulk: {
    type: "object",
    required: ["ids", "action"],
    properties: {
      ids: { ...ids, minItems: 1 },
      action: { enum: ["complete", "reopen", "delete"] },
    },
  },
  attachment: ref("Attachment"),
  share: {
    type: "object",
    properties: { lifetimeHours: { type: "number", minimum: 0 } },
  },
  token: {
    type: "object",
    required: ["name"],
    properties: {
      name: str(80),
      scopes: {
        type: "array",
        items: { enum: API_SCOPES },
        minItems: 1,
        default: ["read"],
      },
      lifetimeDays: { type: "integer", minimum: 1 },
      resourceMode: { enum: ["all", "selected"], default: "all" },
      projectIds: ids,
      listIds: ids,
    },
  },
  filePatch: {
    type: "object",
    required: ["name"],
    properties: { name: str(255) },
  },
  user: {
    ...accountInputs.register,
    properties: {
      ...accountInputs.register.properties,
      role: { enum: ["admin", "user"], default: "user" },
    },
  },
  userPatch: {
    type: "object",
    properties: {
      username: str(32),
      email: { type: "string", format: "email" },
      role: { enum: ["admin", "user"] },
      active: bool,
    },
  },
  settings: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...schemas.WorkspaceSettings.properties,
      ...schemas.AuthSettings.properties,
    },
  },
  aiGenerate: {
    type: "object",
    required: ["listId", "prompt"],
    properties: {
      listId: id,
      prompt: str(8000),
      parentTaskId: { type: ["string", "null"] },
      currentTitle: str(500),
      currentDescription: str(64000),
    },
  },
  aiRefactor: {
    type: "object",
    properties: {
      type: { enum: ["both", "title", "description"], default: "both" },
      generateSubtasks: bool,
      includeSubtasks: bool,
    },
  },
};
for (const operation of API_OPERATIONS) {
  const path = "/api/v1" + operation.path,
    method = operation.method.toLowerCase();
  const collection =
    operation.method === "GET" &&
    ((operation.path.split("/").length === 2 &&
      [
        "projects",
        "lists",
        "tasks",
        "tags",
        "files",
        "tokens",
        "users",
      ].includes(operation.path.slice(1))) ||
      operation.path.endsWith("/lists") ||
      operation.path.endsWith("/tasks") ||
      operation.path.endsWith("/tags"));
  const query = collection
    ? [
        ["limit", false, "1..500, default 100"],
        ["offset", false, "Default 0"],
      ]
    : [];
  if (operation.path === "/users/lookup")
    query.push(["q", true, "Username o email esatti"]);
  if (["/tasks", "/tags"].includes(operation.path))
    query.push(["listId", true]);
  if (operation.path === "/lists" || operation.path === "/files")
    query.push([operation.path === "/lists" ? "projectId" : "listId", false]);
  if (operation.path.endsWith("/tasks") || operation.path === "/tasks")
    query.push(
      ["q", false, "Titolo e descrizione; mantiene gli antenati"],
      ["completed", false, "true per completate, default attive"],
      ["favorites", false],
      ["tags", false, "ID separati da virgola"],
      ["parentTaskId", false, "ID o null"],
    );
  if (method === "delete" && operation.path.endsWith("/attachments"))
    query.push(["url", true]);
  if (operation.path.endsWith("/caddy"))
    query.push(["target", false, "standalone o docker"]);
  const status =
    (method === "post" &&
      [
        "login",
        "register",
        "project",
        "list",
        "task",
        "tag",
        "share",
        "token",
        "user",
        "upload",
      ].includes(operation.body)) ||
    operation.path.endsWith("/copy")
      ? "201"
      : "200";
  add(path, method, operation.summary, {
    input: v1Bodies[operation.body],
    status,
    publicRoute: operation.public,
    query,
    description: `${operation.scope ? "Scope richiesto: " + operation.scope + ". " : "Token valido richiesto salvo endpoint pubblico. "}${collection ? "Risposta paginata: data è un array, pagination contiene total, limit, offset, hasMore. " : ""}I permessi delle risorse restano quelli del proprietario del token. DELETE /users/{id} disabilita l’account conservando i dati.`,
  });
  const spec = paths[path][method];
  spec.tags = [operation.path.split("/")[1]];
  spec["x-required-scope"] = operation.scope;
  spec.security = operation.public
    ? []
    : [{ bearerToken: [] }, { sessionCookie: [] }];
  for (const param of spec.parameters || [])
    if (param.name === "Origin") {
      param.required = false;
      param.description =
        "Obbligatorio per cookie; per Bearer o autenticazione JSON pubblica può essere omesso. Se fornito deve essere same-origin.";
    }
  if (collection)
    spec.responses[status].content["application/json"].schema = {
      type: "object",
      required: ["success", "data", "pagination"],
      properties: {
        success: { const: true },
        data: { type: "array", items: { type: "object" } },
        pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
            hasMore: bool,
          },
        },
      },
    };
  if (operation.binary)
    spec.responses[status] = {
      description: "File privato scaricabile",
      content: {
        "application/octet-stream": {
          schema: { type: "string", format: "binary" },
        },
      },
    };
  if (operation.body === "upload")
    spec.requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: {
              file: { type: "string", format: "binary" },
              files: {
                type: "array",
                items: { type: "string", format: "binary" },
              },
              listId: id,
            },
            description:
              "Almeno un campo file o files. listId richiesto per token con risorse selezionate.",
          },
        },
      },
    };
}
// The request samples and assertions remain local; no credentials are stored here.
const sampleBodies = {
  login: { login: "{{login}}", password: "{{password}}", name: "Postman" },
  register: {
    username: "{{username}}",
    email: "{{email}}",
    password: "{{password}}",
  },
  project: { title: "Progetto API", slug: "progetto-api" },
  projectPatch: { title: "Progetto aggiornato" },
  list: { title: "Lista API", slug: "lista-api", projectId: "{{projectId}}" },
  listPatch: { title: "Lista aggiornata" },
  task: { listId: "{{listId}}", title: "Attività API" },
  taskPatch: { description: "Aggiornata via API" },
  tag: { listId: "{{listId}}", name: "API", color: "#b94406" },
  tagPatch: { name: "Priorità" },
  members: { members: [] },
  move: { listId: "{{destinationListId}}", parentTaskId: null },
  reorder: { ids: ["{{taskId}}"] },
  bulk: { ids: ["{{taskId}}"], action: "complete" },
  attachment: {
    name: "allegato.txt",
    url: "/api/files/{{fileId}}",
    mimeType: "application/octet-stream",
  },
  share: { lifetimeHours: 24 },
  token: {
    name: "Client Postman",
    scopes: ["tasks:read"],
    resourceMode: "selected",
    listIds: ["{{listId}}"],
  },
  filePatch: { name: "documento.txt" },
  user: {
    username: "api_member",
    email: "member@example.test",
    password: "{{password}}",
    role: "user",
  },
  userPatch: { active: true },
  settings: { siteName: "ErvisioTodo" },
  email: { email: "{{email}}" },
  reset: { token: "{{resetToken}}", password: "{{password}}" },
  verify: { token: "{{verifyToken}}" },
  password: { currentPassword: "{{password}}", password: "{{newPassword}}" },
  aiGenerate: { listId: "{{listId}}", prompt: "Prepara la prossima release" },
  aiRefactor: { type: "both", generateSubtasks: false, includeSubtasks: false },
};
const variableFor = (operation, name) =>
  name === "shareId"
    ? "shareId"
    : operation.path.startsWith("/projects")
      ? "projectId"
      : operation.path.startsWith("/lists")
        ? "listId"
        : operation.path.startsWith("/tasks")
          ? "taskId"
          : operation.path.startsWith("/tags")
            ? "tagId"
            : operation.path.startsWith("/files")
              ? "fileId"
              : operation.path.startsWith("/users")
                ? "userId"
                : "tokenId";
const groups = new Map();
for (const operation of API_OPERATIONS) {
  const family = operation.path.split("/")[1];
  if (!groups.has(family)) groups.set(family, []);
  let raw =
    "{{baseUrl}}/api/v1" +
    operation.path.replace(
      /\{(\w+)\}/g,
      (_, name) => `{{${variableFor(operation, name)}}}`,
    );
  if (operation.path === "/users/lookup") raw += "?q={{username}}";
  if (
    ["/tasks", "/tags"].includes(operation.path) &&
    operation.method === "GET"
  )
    raw += "?listId={{listId}}";
  if (operation.path.endsWith("/attachments") && operation.method === "DELETE")
    raw += "?url=/api/files/{{fileId}}";
  const request = {
    method: operation.method,
    header: [],
    url: raw,
    description:
      operation.summary +
      (operation.scope ? ` — Scope: ${operation.scope}` : ""),
  };
  if (operation.public) request.auth = { type: "noauth" };
  if (operation.body === "upload")
    request.body = {
      mode: "formdata",
      formdata: [
        { key: "listId", value: "{{listId}}", type: "text" },
        { key: "file", type: "file", src: [] },
      ],
    };
  else if (operation.body) {
    request.header.push({ key: "Content-Type", value: "application/json" });
    request.body = {
      mode: "raw",
      raw: JSON.stringify(sampleBodies[operation.body] || {}, null, 2),
      options: { raw: { language: "json" } },
    };
  }
  const script = [
    "pm.test('Risposta riuscita', () => pm.expect(pm.response.code).to.be.within(200, 299));",
  ];
  if (!operation.binary)
    script.push(
      "if (pm.response.code < 300) pm.test('Envelope valido', () => pm.expect(pm.response.json().success).to.eql(true));",
    );
  if (operation.path === "/auth/login")
    script.push(
      "if (pm.response.code === 201) pm.collectionVariables.set('apiToken', pm.response.json().data.token);",
    );
  if (
    operation.method === "POST" &&
    ["/projects", "/lists", "/tasks", "/tags", "/users"].includes(
      operation.path,
    )
  )
    script.push(
      `if (pm.response.code === 201) { const data = pm.response.json().data; pm.collectionVariables.set('${variableFor(operation, "id")}', data._id || data.id); }`,
    );
  groups.get(family).push({
    name: operation.method + " " + operation.path,
    request,
    event: [
      { listen: "test", script: { type: "text/javascript", exec: script } },
    ],
  });
}
writeFileSync(
  "docs/ErvisioTodo.postman_collection.json",
  JSON.stringify(
    {
      info: {
        name: "ErvisioTodo API v1",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        description:
          "Generata dal catalogo locale. Configura baseUrl, login/password o apiToken nelle variabili private. Le richieste modificano dati: eseguile singolarmente in ambiente di test.",
      },
      auth: {
        type: "bearer",
        bearer: [{ key: "token", value: "{{apiToken}}", type: "string" }],
      },
      variable: [
        "baseUrl",
        "apiToken",
        "login",
        "password",
        "username",
        "email",
        "projectId",
        "listId",
        "taskId",
        "tagId",
        "fileId",
        "userId",
        "tokenId",
        "shareId",
        "destinationListId",
        "resetToken",
        "verifyToken",
        "newPassword",
      ].map((key) => ({
        key,
        value: key === "baseUrl" ? "http://localhost:3000" : "",
      })),
      item: [...groups].map(([name, item]) => ({ name, item })),
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  "docs/openapi.json",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "ErvisioTodo",
        version: "0.3.0",
        description:
          "API con sessione HTTP-only e token Bearer personali. Auth.js /api/auth/* usa il proprio protocollo CSRF/OAuth ed è documentato dal progetto Auth.js. Nessuna API key pubblica. Vedi API.md per permessi e semantica.",
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Installazione locale; sostituire con AUTH_URL",
        },
      ],
      components: {
        securitySchemes: {
          bearerToken: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "evt_<opaque>",
            description:
              "Token personale: scadenza, ambiti granulari e selezione di progetti/liste; derivazione con attenuazione e revoca a cascata.",
          },
          sessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "__Secure-ervisio.session-token",
            description:
              "In HTTP locale il nome è ervisio.session-token. Gestito da Auth.js, non da compilare manualmente.",
          },
        },
        schemas,
      },
      paths,
    },
    null,
    2,
  ) + "\n",
);
