const config = {
  mongodb: {
    url: process.env.MONGO_URI || 'mongodb://localhost:27017',
    databaseName: process.env.MONGO_DB_NAME || 'lahtha_click_dev',
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  migrationFileExtension: '.cjs',
  useFileHash: false,
  moduleSystem: 'commonjs',
};

module.exports = config;
