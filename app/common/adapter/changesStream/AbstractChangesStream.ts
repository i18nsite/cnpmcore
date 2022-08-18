import {
  ImplDecorator,
  Inject,
  QualifierImplDecoratorUtil,
} from '@eggjs/tegg';
import { RegistryType } from 'app/common/enum/Registry';
import { Readable } from 'node:stream';
import { Registry } from 'app/core/entity/Registry';
import {
  EggHttpClient,
  EggLogger,
} from 'egg';

export const CHANGE_STREAM_ATTRIBUTE = 'CHANGE_STREAM_ATTRIBUTE';
export type ChangesStreamChange = {
  seq: string;
  fullname: string;
};

export abstract class AbstractChangeStream {
  @Inject()
  protected logger: EggLogger;

  @Inject()
  protected httpclient: EggHttpClient;

  abstract getInitialSince(registry: Registry): Promise<string>;
  abstract fetchChanges(registry: Registry, since: string): Promise<Readable>;
}

export const RegistryChangesStream: ImplDecorator<AbstractChangeStream, typeof RegistryType> =
  QualifierImplDecoratorUtil.generatorDecorator(AbstractChangeStream, CHANGE_STREAM_ATTRIBUTE);
