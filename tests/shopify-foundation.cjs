/* eslint-disable @typescript-eslint/no-require-imports -- The Node CJS fixture loader transpiles TypeScript modules in memory. */
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(root, 'src', request.slice(2));
  return originalResolve.call(this, request, parent, ...rest);
};
Module._load = function (request, parent, ...rest) {
  if (request === 'server-only') return {};
  if (request === '@/lib/db') return { __esModule: true, default: async () => ({}) };
  if (request === '@/lib/auth') return { authenticateRequest: async () => ({ role: 'ADMIN' }) };
  return originalLoad.call(this, request, parent, ...rest);
};
Module._extensions['.ts'] = function (mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText;
  mod._compile(output, filename);
};

const { getShopifyStatus, getShopifyAdminConfig, getShopifyWebhookConfig, isShopifyWebhookConfigured, ShopifyError } = require('../src/lib/shopify/config.ts');
const { shopifyGraphQL } = require('../src/lib/shopify/client.ts');
const { toMinorUnits } = require('../src/lib/shopify/money.ts');
const { verifyShopifyWebhook, webhookOrderId } = require('../src/lib/shopify/webhook.ts');
const { getProducts, getProductByHandle, getCollections, getCollectionByHandle } = require('../src/lib/shopify/catalog.ts');
const { getBlogs, getArticles, getArticleByHandle } = require('../src/lib/shopify/content.ts');
const { normalizeOrder, synchronizeShopifyOrder } = require('../src/lib/shopify/orders.ts');
const { buildCommerceCashFlow, combineCashFlows } = require('../src/lib/shopify/reporting.ts');
const ShopifyOrder = require('../src/models/ShopifyOrder.ts').default;
const { GET: getShopifyStatusRoute } = require('../src/app/api/shopify/status/route.ts');

const originalEnv = {
  SHOPIFY_SHOP_DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN,
  SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,
};
function configure() {
  process.env.SHOPIFY_SHOP_DOMAIN = 'fixture.myshopify.com';
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'fixture-token';
  process.env.SHOPIFY_WEBHOOK_SECRET = 'fixture-secret';
}
test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const pageInfo = { hasNextPage: false, endCursor: null };
const image = { id: 'gid://shopify/MediaImage/1', url: 'https://example.invalid/p.png', altText: 'P', width: 20, height: 30 };
const product = {
  id: 'gid://shopify/Product/1', handle: 'sample', title: 'Sample', description: 'Plain', descriptionHtml: '<p>Plain</p>',
  vendor: 'Vendor', productType: 'Cream', status: 'ACTIVE', tags: ['tag'], category: { id: 'gid://shopify/TaxonomyCategory/1', name: 'Skin', fullName: 'Beauty > Skin' },
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z', seo: { title: 'SEO', description: 'Desc' },
  collections: { nodes: [{ id: 'gid://shopify/Collection/1' }] },
  media: { nodes: [{ __typename: 'MediaImage', id: image.id, image }] },
  variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1', title: 'Small', sku: 'S', barcode: null, selectedOptions: [{ name: 'Size', value: 'S' }], price: '100.00', compareAtPrice: null, availableForSale: true, inventoryQuantity: 3 }], pageInfo },
  options: [{ name: 'Size', values: ['S'] }],
};
const collection = { id: 'gid://shopify/Collection/1', handle: 'skin', title: 'Skin', description: 'D', descriptionHtml: '<p>D</p>', image, updatedAt: '2026-09-02T00:00:00Z', seo: { title: null, description: null } };
const blog = { id: 'gid://shopify/Blog/1', handle: 'news', title: 'News' };
const article = { id: 'gid://shopify/Article/1', handle: 'welcome', title: 'Welcome', summary: '<p>Hi</p>', body: '<p>Body</p>', image, tags: ['news'], publishedAt: '2026-09-02T00:00:00Z', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z', blog };
const order = {
  id: 'gid://shopify/Order/1', name: '#1', currencyCode: 'VND', displayFinancialStatus: 'PARTIALLY_REFUNDED',
  totalPriceSet: { shopMoney: { amount: '300000.00', currencyCode: 'VND' } }, transactionsCount: { count: 2 },
  transactions: [
    { id: 'gid://shopify/OrderTransaction/1', kind: 'SALE', status: 'SUCCESS', test: false, createdAt: '2026-09-17T00:00:00Z', processedAt: null, amountSet: { shopMoney: { amount: '300000', currencyCode: 'VND' } } },
    { id: 'gid://shopify/OrderTransaction/2', kind: 'REFUND', status: 'SUCCESS', test: false, createdAt: '2026-09-18T00:00:00Z', processedAt: null, amountSet: { shopMoney: { amount: '100000', currencyCode: 'VND' } } },
  ], test: false, processedAt: '2026-09-17T00:00:00Z', createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z',
};

test('missing configuration and currency precision', async () => {
  delete process.env.SHOPIFY_SHOP_DOMAIN;
  assert.equal(getShopifyStatus(), 'NOT_CONFIGURED');
  await assert.rejects(getProducts(), ShopifyError);
  configure();
  assert.equal(toMinorUnits('300000.00', 'VND'), 300000);
  assert.equal(toMinorUnits('1.23', 'USD'), 123);
  assert.equal(toMinorUnits('1.234', 'KWD'), 1234);
  assert.throws(() => toMinorUnits('1.01', 'VND'));
});

test('Admin configuration safely normalizes a trailing domain slash', () => {
  configure();
  process.env.SHOPIFY_SHOP_DOMAIN = 'fixture.myshopify.com/';
  assert.equal(getShopifyAdminConfig().domain, 'fixture.myshopify.com');
});

test('Admin API readiness does not require a webhook secret', async () => {
  configure();
  delete process.env.SHOPIFY_WEBHOOK_SECRET;
  assert.equal(getShopifyStatus(), 'CONFIGURED');
  assert.equal(isShopifyWebhookConfigured(), false);
  const statusResponse = await getShopifyStatusRoute({ nextUrl: { searchParams: new URLSearchParams() } });
  assert.deepEqual((await statusResponse.json()).data, { status: 'CONFIGURED', webhookConfigured: false });
  assert.equal(getShopifyAdminConfig().domain, 'fixture.myshopify.com');
  assert.throws(() => getShopifyWebhookConfig(), (error) => error instanceof ShopifyError && error.code === 'NOT_CONFIGURED' && !error.message.includes('fixture-secret'));
  const body = Buffer.from('test');
  const hmac = createHmac('sha256', 'fixture-secret').update(body).digest('base64');
  assert.throws(() => verifyShopifyWebhook(body, hmac), (error) => error instanceof ShopifyError && error.code === 'NOT_CONFIGURED');
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    assert.equal(options.headers['X-Shopify-Access-Token'], 'fixture-token');
    return { ok: true, json: async () => ({ data: { shop: { id: 'gid://shopify/Shop/1' } } }) };
  };
  try { assert.equal((await shopifyGraphQL('query { shop { id } }')).shop.id, 'gid://shopify/Shop/1'); }
  finally { global.fetch = originalFetch; configure(); }
});

test('raw webhook HMAC and Order identity', () => {
  configure();
  const body = Buffer.from(JSON.stringify({ id: 1 }));
  const hmac = createHmac('sha256', 'fixture-secret').update(body).digest('base64');
  assert.equal(verifyShopifyWebhook(body, hmac), true);
  assert.equal(verifyShopifyWebhook(body, null), false);
  assert.equal(verifyShopifyWebhook(Buffer.from('changed'), hmac), false);
  assert.equal(webhookOrderId('orders/paid', { id: 1 }), order.id);
  assert.equal(webhookOrderId('refunds/create', { order_id: 1 }), order.id);
});

test('catalog and content services normalize bounded GraphQL pages', async () => {
  configure();
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    const { query } = JSON.parse(options.body);
    let data;
    if (query.includes('ProductByHandle')) data = { productByHandle: product };
    else if (query.includes('CollectionProducts')) data = { collection: { products: { edges: [{ node: product }], pageInfo } } };
    else if (query.includes('Products')) data = { products: { edges: [{ node: product }], pageInfo: { hasNextPage: true, endCursor: 'next' } } };
    else if (query.includes('CollectionByHandle')) data = { collectionByHandle: collection };
    else if (query.includes('Collections')) data = { collections: { edges: [{ node: collection }], pageInfo } };
    else if (query.includes('ArticleByHandle')) {
      assert.equal(JSON.parse(options.body).variables.search, 'handle:welcome blog_id:1');
      data = { articles: { edges: [{ node: article }], pageInfo } };
    }
    else if (query.includes('Articles')) data = { articles: { edges: [{ node: article }], pageInfo } };
    else if (query.includes('Blogs')) data = { blogs: { edges: [{ node: blog }], pageInfo } };
    else throw new Error('Unexpected fixture query');
    assert.equal(options.headers['X-Shopify-Access-Token'], 'fixture-token');
    return { ok: true, json: async () => ({ data }) };
  };
  try {
    const products = await getProducts({ first: 1 });
    assert.equal(products.pageInfo.endCursor, 'next');
    assert.equal(products.items[0].category.name, 'Skin');
    assert.equal(products.items[0].productType, 'Cream');
    assert.equal(products.items[0].variants[0].selectedOptions[0].value, 'S');
    assert.equal(products.items[0].media[0].url, image.url);
    assert.equal((await getProductByHandle('sample')).handle, 'sample');
    assert.equal((await getCollections()).items[0].image.url, image.url);
    assert.equal((await getCollectionByHandle('skin')).handle, 'skin');
    assert.equal((await getBlogs()).items[0].title, 'News');
    assert.equal((await getArticles()).items[0].blog.handle, 'news');
    assert.equal((await getArticleByHandle('welcome', blog.id)).summary, '<p>Hi</p>');
  } finally { global.fetch = originalFetch; }
});

test('financial normalization keeps gross and refunds distinct', () => {
  const result = normalizeOrder(order, 'fixture.myshopify.com');
  assert.equal(result.orderTotalMinor, 300000);
  assert.equal(result.grossCollectedMinor, 300000);
  assert.equal(result.refundedMinor, 100000);
  assert.equal(result.netCollectedMinor, 200000);
  assert.equal(result.transactions.length, 2);
  assert.equal(result.isTest, false);
  assert.equal(normalizeOrder({ ...order, test: true }, 'fixture.myshopify.com').isTest, true);
  assert.throws(() => normalizeOrder({ ...order, transactions: [...order.transactions, order.transactions[0]], transactionsCount: { count: 3 } }, 'fixture.myshopify.com'));
});

test('combined report conserves VND and blocks mixed currencies', () => {
  const healthcare = { grossCollected: 300000, refunded: 400000, netCollected: -100000 };
  const commerce = { liveOnly: true, orderCount: 1, byCurrency: { VND: { grossCollected: 300000, refunded: 100000, netCollected: 200000 } } };
  assert.deepEqual(combineCashFlows(healthcare, commerce).cashFlow, { grossCollected: 600000, refunded: 500000, netCollected: 100000 });
  assert.equal(combineCashFlows(healthcare, { ...commerce, byCurrency: { ...commerce.byCurrency, USD: { grossCollected: 100, refunded: 0, netCollected: 100 } } }).status, 'MIXED_CURRENCY');
});

test('projection has a unique Order identity index', () => {
  assert.ok(ShopifyOrder.schema.indexes().some(([keys, options]) => keys.shopDomain === 1 && keys.shopifyOrderId === 1 && options.unique === true));
});

test('schema requires safe integer money while allowing signed net cash', async () => {
  const base = normalizeOrder(order, 'fixture.myshopify.com');
  await new ShopifyOrder(base).validate();
  const positiveFields = ['orderTotalMinor', 'grossCollectedMinor', 'refundedMinor'];
  for (const field of positiveFields) {
    for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(new ShopifyOrder({ ...base, [field]: invalid }).validate(), `${field} accepted ${invalid}`);
    }
  }
  for (const invalid of [1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(new ShopifyOrder({ ...base, netCollectedMinor: invalid }).validate(), `netCollectedMinor accepted ${invalid}`);
  }
  await new ShopifyOrder({ ...base, netCollectedMinor: -100000 }).validate();
  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const transactions = base.transactions.map((transaction, index) => index === 0 ? { ...transaction, amountMinor: invalid } : transaction);
    await assert.rejects(new ShopifyOrder({ ...base, transactions }).validate(), `transaction amount accepted ${invalid}`);
  }
});

test('sync retry and stale source timestamp do not duplicate financial effect', async () => {
  configure();
  const originals = { init: ShopifyOrder.init, findOne: ShopifyOrder.findOne, updateOne: ShopifyOrder.updateOne, fetch: global.fetch };
  let stored = null;
  let source = order;
  ShopifyOrder.init = async () => ShopifyOrder;
  ShopifyOrder.findOne = () => ({ select: async () => stored });
  ShopifyOrder.updateOne = async (_filter, update) => {
    if (stored && stored.sourceUpdatedAt >= update.$set.sourceUpdatedAt) {
      throw Object.assign(new Error('unique identity race'), { code: 11000 });
    }
    const created = !stored;
    stored = update.$set;
    return { upsertedCount: created ? 1 : 0, modifiedCount: created ? 0 : 1 };
  };
  global.fetch = async () => ({ ok: true, json: async () => ({ data: { order: source } }) });
  try {
    assert.equal(await synchronizeShopifyOrder(order.id, 'delivery-1'), 'CREATED');
    assert.equal(stored.lastWebhookId, 'delivery-1');
    assert.equal(await synchronizeShopifyOrder(order.id, 'delivery-2'), 'UNCHANGED');
    assert.equal(stored.lastWebhookId, 'delivery-1');
    assert.equal(stored.transactions.length, 2);
    source = { ...order, transactions: [...order.transactions].reverse() };
    assert.equal(await synchronizeShopifyOrder(order.id), 'UNCHANGED');
    source = { ...order, transactions: [...order.transactions, { ...order.transactions[1], id: 'gid://shopify/OrderTransaction/3' }], transactionsCount: { count: 3 } };
    await assert.rejects(synchronizeShopifyOrder(order.id), (error) => error instanceof ShopifyError && error.code === 'DATA_INTEGRITY');
    assert.equal(stored.refundedMinor, 100000);
    source = { ...order, updatedAt: '2026-09-19T00:00:00Z', transactions: [...order.transactions, { ...order.transactions[1], id: 'gid://shopify/OrderTransaction/3', amountSet: { shopMoney: { amount: '50000', currencyCode: 'VND' } } }], transactionsCount: { count: 3 } };
    assert.equal(await synchronizeShopifyOrder(order.id, 'delivery-3'), 'UPDATED');
    assert.equal(stored.refundedMinor, 150000);
    assert.equal(stored.lastWebhookId, 'delivery-3');
    source = order;
    assert.equal(await synchronizeShopifyOrder(order.id, 'delivery-4'), 'UNCHANGED');
    assert.equal(stored.refundedMinor, 150000);
    assert.equal(stored.lastWebhookId, 'delivery-3');
  } finally {
    Object.assign(ShopifyOrder, { init: originals.init, findOne: originals.findOne, updateOne: originals.updateOne });
    global.fetch = originals.fetch;
  }
});

test('commerce cash flow excludes test Orders and selects transaction dates', async () => {
  const originalFind = ShopifyOrder.find;
  const refundOnly = normalizeOrder(order, 'fixture.myshopify.com');
  const testOrder = { ...refundOnly, isTest: true };
  ShopifyOrder.find = (filter) => ({ select: () => ({ limit: () => ({ lean: async () => [refundOnly, testOrder].filter((item) => filter.isTest !== false || !item.isTest) }) }) });
  try {
    const cash = await buildCommerceCashFlow({ from: new Date('2026-09-18T00:00:00Z'), to: new Date('2026-09-19T00:00:00Z') });
    assert.equal(cash.liveOnly, true);
    assert.deepEqual(cash.byCurrency.VND, { grossCollected: 0, refunded: 100000, netCollected: -100000 });
  } finally { ShopifyOrder.find = originalFind; }
});
