import { beforeAll, describe, expect, it } from '@jest/globals';
import { Controller, Post } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import { AllExceptionsFilter } from '../filters/index.js';
import { zodDto } from '../dto/index.js';
import { ZodBody } from './ZodBody.decorator.js';

import type { INestApplication } from '@nestjs/common';
import type { InferDto } from '../dto/index.js';
import type { Response } from 'supertest';
import type { Server } from 'node:http';

const NoteDto = zodDto('Note', z.object({ title: z.string().min(3) }));
type NoteDto = InferDto<typeof NoteDto>;

@Controller('notes')
class NotesController {
  @Post()
  write(@ZodBody(NoteDto) body: NoteDto): NoteDto {
    return body;
  }
}

/**
 * The decorator's whole claim is that the enforced body and the published body
 * are one thing. Asserting either half alone would pass while the other rotted,
 * so both are checked against the same route.
 */
describe('ZodBody', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [NotesController] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(express.json());
    await app.init();
  });

  it('parses the body and drops what the schema does not name', async () => {
    const response: Response = await request(app.getHttpServer() as Server)
      .post('/notes')
      .send({ smuggled: true, title: 'hello' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ title: 'hello' });
  });

  it('refuses a body the schema rejects, as an unprocessable entity', async () => {
    const response: Response = await request(app.getHttpServer() as Server)
      .post('/notes')
      .send({ title: 'no' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('publishes the rule it enforces, under the DTO name', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const published = JSON.stringify(document.paths['/notes']?.post?.requestBody);

    expect(published).toContain('"minLength":3');
    expect(published).toContain('"title":"Note"');
  });
});
