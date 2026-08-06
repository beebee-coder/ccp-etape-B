export {
  PrioritySchema,
  StepTypeSchema,
  MediaTypeSchema,
  AlarmTypeSchema,
  MediaRequirementSchema,
  AlarmConfigSchema,
  StepSchema,
  MetadataSchema,
  ProcedureSchema,
  ExecutionContextSchema,
  ProcedureExecutionSchema,
} from "@/lib/procedures/services/validator.service";

export type {
  TMetadata,
  TStep,
  TMediaRequirement,
  TAlarmConfig,
  TProcedure,
  TExecutionContext,
  TProcedureExecution,
} from "@/lib/procedures/services/validator.service";

export {
  MediaItemSchema,
  MediaItemInputSchema,
  MediaItemUpdateSchema,
  type MediaItem,
  type MediaItemMeta,
  type GetAllOptions,
  type ImageStats,
} from "@/lib/images/server-store";

export {
  EtatDesLieuxReportSchema,
  EtatDesLieuxReportInputSchema,
  MediaAttachmentSchema,
  type EtatDesLieuxReport,
  type MediaAttachment,
} from "@/lib/etat-des-lieux/server-store";

export {
  AdviceRequestSchema,
  type AdviceRequest,
} from "@/lib/ai/advice-schema";
export { AIChatRequestSchema, type AIChatRequest } from "@/lib/ai/chat-schema";
export {
  PipelineConfigSchema,
  type PipelineConfig,
} from "@/lib/pipeline/pipeline-schema";
export {
  ActuatorToggleSchema,
  SensorCameraSchema,
  SensorMicrophoneSchema,
  SensorTemperatureSchema,
  SensorReadingSchema,
  ActuatorStateSchema,
  DeviceConnectionInfoSchema,
  ConnectionTypeSchema,
  ConnectionStatusSchema,
} from "@/lib/embedded/schemas";

export type {
  ActuatorToggle,
  SensorReading,
  ActuatorState,
  DeviceConnectionInfo,
  ConnectionType,
  ConnectionStatus,
} from "@/lib/embedded/schemas";

export {
  NodeKindSchema,
  SyncStateSchema,
  NodeStatsSchema,
  DatabaseTreeNodeSchema,
  DatabaseStructureSchema,
  type NodeKind,
  type SyncState,
  type NodeStats,
  type DatabaseTreeNode,
  type DatabaseStructure,
} from "@/lib/types/structure-bdd";

export {
  TeamMemberStatusSchema,
  TeamMemberSchema,
  TeamInfoSchema,
  CreateTeamPayloadSchema,
  CreateTeamMemberPayloadSchema,
  UpdateTeamPayloadSchema,
  UpdateTeamMemberPayloadSchema,
  type TeamMemberStatus,
  type TeamMember,
  type TeamInfo,
  type CreateTeamPayload,
  type CreateTeamMemberPayload,
  type UpdateTeamPayload,
  type UpdateTeamMemberPayload,
} from "@/lib/teams/schemas";

export {
  MeetingSchema,
  MeetingChatMessageSchema,
  CreateMeetingSchema,
  CreateMeetingChatMessageSchema,
  EndMeetingSchema,
  UpdateParticipantSchema,
  MeetingParticipantSchema,
  type Meeting,
  type MeetingChatMessage,
  type CreateMeetingInput,
  type CreateMeetingChatMessageInput,
  type EndMeetingInput,
  type UpdateParticipantInput,
  type MeetingParticipant,
} from "@/lib/types/video";

export {
  EntityTypeSchema,
  LocalMetaSchema,
  LocalMetaInputSchema,
  LocalMetaFileSchema,
  SyncQueueItemSchema,
  SyncManifestSchema,
  type EntityType,
  type LocalMeta,
  type LocalMetaInput,
  type LocalMetaFile,
  type SyncQueueItem,
  type SyncManifest,
} from "@/lib/types/local-db";
