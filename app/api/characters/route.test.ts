import { GET, POST, PUT, DELETE } from './route';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

describe('Characters API', () => {
  beforeAll(async () => {
    await prisma.character.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a new character', async () => {
    const newCharacter = {
      name: 'Test Character',
      personality: 'Test Personality',
      backstory: 'Test Backstory',
      instagramHandle: '@testcharacter',
      preferredModel: 'test_model',
      triggerWord: 'test_trigger',
      promptSettings: {
        basePrompt: 'test base prompt',
        negativePrompt: 'test negative prompt',
        style: 'test style',
        mood: 'test mood',
        customPrompts: ['test custom prompt'],
      },
    };

    const req = new NextRequest('http://localhost/api/characters', {
      method: 'POST',
      body: JSON.stringify(newCharacter),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.character).toHaveProperty('id');
    expect(data.character.name).toBe(newCharacter.name);
  });

  it('should get all characters', async () => {
    const req = new NextRequest('http://localhost/api/characters');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.characters)).toBe(true);
  });

  it('should update a character', async () => {
    const character = await prisma.character.create({
      data: {
        name: 'Update Test',
        personality: 'Update Personality',
        backstory: 'Update Backstory',
        instagramHandle: '@updatetest',
      },
    });

    const updates = {
      id: character.id,
      name: 'Updated Character',
    };

    const req = new NextRequest('http://localhost/api/characters', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.character.name).toBe(updates.name);
  });

  it('should delete a character', async () => {
    const character = await prisma.character.create({
      data: {
        name: 'Delete Test',
        personality: 'Delete Personality',
        backstory: 'Delete Backstory',
        instagramHandle: '@deletetest',
      },
    });

    const req = new NextRequest('http://localhost/api/characters', {
      method: 'DELETE',
      body: JSON.stringify({ id: character.id }),
    });

    const res = await DELETE(req);

    expect(res.status).toBe(204);
  });
});
