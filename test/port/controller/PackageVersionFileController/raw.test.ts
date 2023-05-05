import { strict as assert } from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { calculateIntegrity } from 'app/common/PackageUtil';

describe('test/port/controller/PackageVersionFileController/raw.test.ts', () => {
  let publisher;
  let adminUser;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    publisher = await TestUtil.createUser();
  });

  describe('[GET /:fullname/:versionOrTag/files/:path] raw()', () => {
    it('should show one package version raw file', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .get('/foo/1.0.0/files/package.json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        name: 'mk2testmodule',
        version: '0.0.1',
        description: '',
        main: 'index.js',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        author: '',
        license: 'ISC',
      });

      // again should work
      res = await app.httpRequest()
        .get('/foo/1.0.0/files/package.json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert(!res.headers['content-disposition']);
      assert.deepEqual(res.body, {
        name: 'mk2testmodule',
        version: '0.0.1',
        description: '',
        main: 'index.js',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        author: '',
        license: 'ISC',
      });

      // should redirect on tag request
      res = await app.httpRequest()
        .get(`/${pkg.name}/latest/files/package.json`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files/package.json`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
    });

    it('should show one package version file meta', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .get('/foo/1.0.0/files/package.json?meta')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/package.json',
        type: 'file',
        contentType: 'application/json',
        integrity: 'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
        lastModified: '2014-02-25T10:53:34.000Z',
        size: 209,
      });

      res = await app.httpRequest()
        .get(`/${pkg.name}/latest/files/package.json?meta=2`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files/package.json?meta=2`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');

      // file path not exists
      res = await app.httpRequest()
        .get('/foo/1.0.0/files/package2.json?meta')
        .expect(404);
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert.equal(res.body.error, `[NOT_FOUND] File ${pkg.name}@1.0.0/package2.json not found`);
    });

    it('should ignore not exists file on tar onentry', async () => {
      const tarball = await TestUtil.readFixturesFile('unpkg.com/ide-metrics-api-grpc-0.0.1-main-gha.8962.tgz');
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.status, 200);
    });

    it('should support non-ascii file name', async () => {
      // https://unpkg.com/browse/@ppwcode/openapi@7.3.3/resource/ToOneFrom%CF%87.js
      const tarball = await TestUtil.readFixturesFile('unpkg.com/openapi-7.3.3.tgz');
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      await setTimeout(1000);
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/resource/`);
      assert.equal(res.status, 200);
      // console.log(res.body);
      assert(res.body.files.find(file => file.path === '/resource/ToOneFromχ.js'));
      // res = await app.httpRequest()
      // .get(`/${pkg.name}/1.0.0/files/resource/ToOneFromχ.js`);
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/resource/ToOneFrom%CF%87.js`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/javascript; charset=utf-8');
      // console.log(res.text);
      assert.match(res.text, /ToOneFromχ/);
    });

    it('should handle big tgz file', async () => {
      const tarball = await TestUtil.readFixturesFile('unpkg.com/pouchdb-3.2.1.tgz');
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      await setTimeout(5000);
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.status, 200);
      // console.log('%o', res.body);
      assert(res.body.files.find(file => file.path === '/CONTRIBUTING.md'));
      let testDir = res.body.files.find(file => file.path === '/tests');
      assert(testDir);
      assert(testDir.files.length > 0);
      let integrationDir1 = testDir.files.find(file => file.path === '/tests/integration');
      assert(integrationDir1);
      assert(integrationDir1.files.length > 0);
      assert.equal(integrationDir1.type, 'directory');
      assert(integrationDir1.files.find(file => file.path === '/tests/integration/test.replication.js'));
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.body.path, '/');

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files?meta=true`);
      assert.equal(res.status, 200);
      // console.log('%o', res.body);
      assert(res.body.files.find(file => file.path === '/CONTRIBUTING.md'));
      testDir = res.body.files.find(file => file.path === '/tests');
      assert(testDir);
      assert(testDir.files.length > 0);
      integrationDir1 = testDir.files.find(file => file.path === '/tests/integration');
      assert(integrationDir1);
      assert(integrationDir1.files.length > 0);
      assert.equal(integrationDir1.type, 'directory');
      assert(integrationDir1.files.find(file => file.path === '/tests/integration/test.replication.js'));
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.body.path, '/');

      // redirect to main file
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files`);
      assert.equal(res.status, 302);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files/lib/index.js`);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/lib/index.js`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'application/javascript; charset=utf-8');
      assert.equal(res.headers['transfer-encoding'], 'chunked');

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/docs/_site/getting-started.html`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
      assert.equal(res.headers['content-disposition'], 'attachment; filename="getting-started.html"');
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /<!DOCTYPE html>/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/docs/_site/getting-started.html?meta`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.deepEqual(res.body, {
        path: '/docs/_site/getting-started.html',
        type: 'file',
        contentType: 'text/html',
        integrity: 'sha512-o/nCeU2MBJpIWhA8gIbf6YW49Ss3Spga5M70LJjjyRMlALQDmeh8IVMXagAe79l1Yznci/otKtNjWhVMOM38hg==',
        lastModified: '2015-01-05T21:14:06.000Z',
        size: 26716,
      });

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/tests`);
      assert.equal(res.status, 404);
      assert.equal(res.body.error, '[NOT_FOUND] File @cnpm/foo-tag-latest@1.0.0/tests not found');

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/tests/`);
      assert.equal(res.status, 200);
      // console.log('%o', res.body);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.body.path, '/tests');
      // make sure sub dirs exists
      const integrationDir = res.body.files.find(file => file.path === '/tests/integration');
      assert(integrationDir);
      assert(integrationDir.files.length > 0);
      assert.equal(integrationDir.type, 'directory');
      assert(integrationDir.files.find(file => file.path === '/tests/integration/test.replication.js'));

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/tests/integration/test.http.js`);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'application/javascript; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /describe\(/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/tests/integration/test.http.js?meta`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.deepEqual(res.body, {
        path: '/tests/integration/test.http.js',
        type: 'file',
        contentType: 'application/javascript',
        integrity: 'sha512-yysF4V48yKDI9yWuROuPd9cn9dn3nFQaAGkGMe46l6htQ6ZsoX4SAw9+FkhmmPez2VjxW/lYhWy21R1oOOu8Fw==',
        lastModified: '2014-12-29T16:20:41.000Z',
        size: 1917,
      });

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/README.md`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'text/markdown; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /The Javascript Database that Syncs/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/.travis.yml`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'text/yaml; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /language: node_js/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/LICENSE`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      // FIXME: should be text/plain
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /Apache License/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/.npmignore`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      // FIXME: should be text/plain
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/bin/release.sh`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'application/x-sh');
      assert(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /#\!\/bin\/bash/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/docs/manifest.appcache`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'text/cache-manifest; charset=utf-8');
      assert(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /CACHE MANIFEST/);
    });

    it('should 451 when package block', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests again',
        });
      assert.equal(res.status, 201);
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/index.js`)
        .expect(451)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.match(res.body.error, /\[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm\/testmodule@1.0.0 was blocked, reason: only for tests again/);
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
        versionObject: {
          description: 'foo description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      let res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.40000404/files/foo.json`)
        .expect(404);
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.40000404/files/bin/foo/bar.js`)
        .expect(404);
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);
    });
  });
});