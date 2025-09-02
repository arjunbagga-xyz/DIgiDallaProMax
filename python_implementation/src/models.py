from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class PromptSettings(BaseModel):
    basePrompt: str
    negativePrompt: str
    style: str
    mood: str

class Narrative(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    startDate: datetime
    endDate: datetime

class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    personality: str
    backstory: str
    instagramHandle: Optional[str] = None
    twitterHandle: Optional[str] = None
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    preferredModel: Optional[str] = None
    triggerWord: Optional[str] = None
    promptSettings: PromptSettings
    narratives: List[Narrative] = []
    instagramAccountId: Optional[str] = None
    instagramApiKey: Optional[str] = None
    twitterAccountId: Optional[str] = None
    twitterAppKey: Optional[str] = None
    twitterAppSecret: Optional[str] = None
    twitterAccessToken: Optional[str] = None
    twitterAccessSecret: Optional[str] = None


# Models for Image Generation
class ImageGenerationRequest(BaseModel):
    characterId: str
    prompt: str
    negative_prompt: Optional[str] = ""
    model: Optional[str] = None

class ImageGenerationResponse(BaseModel):
    image_path: str
    metadata: dict


# Models for Social Media Posting
class SocialMediaPostRequest(BaseModel):
    characterId: str
    image_path: str
    caption: str

class SocialMediaPostResponse(BaseModel):
    platform: str
    post_id: str
    post_url: str


# Models for Scheduler
class ScheduledTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    characterId: str
    type: str  # e.g., 'generate_and_post'
    schedule: str  # cron expression
    active: bool = True
    config: dict = {}

class ScheduledTaskCreate(BaseModel):
    characterId: str
    type: str
    schedule: str
    active: bool = True
    config: dict = {}


# Models for LoRA Training
class LoraTrainingRequest(BaseModel):
    characterId: str
    baseModel: str
    image_paths: List[str]

class LoraTrainingResponse(BaseModel):
    message: str
    job_id: str
    log_file: str


class CaptionRequest(BaseModel):
    prompt: str
    characterName: str
    personality: str
    backstory: str

class CaptionResponse(BaseModel):
    caption: str


# Models for Prompts
class Prompt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    characterId: str
    characterName: str
    prompt: str
    caption: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    used: bool = False

class PromptCreate(BaseModel):
    characterId: str
    prompt: str


class SystemStatus(BaseModel):
    database: str
    comfyui: str
    scheduler: str
    gemini_api: str


class CharacterCreate(BaseModel):
    name: str
    personality: str
    backstory: str
    instagramHandle: Optional[str] = None
    twitterHandle: Optional[str] = None
    isActive: bool = True
    preferredModel: Optional[str] = None
    triggerWord: Optional[str] = None
    promptSettings: PromptSettings
    narratives: List[Narrative] = []
    instagramAccountId: Optional[str] = None
    instagramApiKey: Optional[str] = None
    twitterAccountId: Optional[str] = None
    twitterAppKey: Optional[str] = None
    twitterAppSecret: Optional[str] = None
    twitterAccessToken: Optional[str] = None
    twitterAccessSecret: Optional[str] = None

class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    personality: Optional[str] = None
    backstory: Optional[str] = None
    instagramHandle: Optional[str] = None
    twitterHandle: Optional[str] = None
    isActive: Optional[bool] = None
    preferredModel: Optional[str] = None
    triggerWord: Optional[str] = None
    promptSettings: Optional[PromptSettings] = None
    narratives: Optional[List[Narrative]] = None
    instagramAccountId: Optional[str] = None
    instagramApiKey: Optional[str] = None
    twitterAccountId: Optional[str] = None
    twitterAppKey: Optional[str] = None
    twitterAppSecret: Optional[str] = None
    twitterAccessToken: Optional[str] = None
    twitterAccessSecret: Optional[str] = None
