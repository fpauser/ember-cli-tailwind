'use strict';

const fs = require('fs');
const path = require('path');
const Funnel = require('broccoli-funnel');
const Rollup = require('broccoli-rollup');
const BuildTailwindPlugin = require('./lib/build-tailwind-plugin');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');

const buildDestinations = {
  dummy: {
    path: 'tests/dummy/app',
    type: 'app'
  },
  app: {
    path: 'app',
    type: 'app'
  },
  addon: {
    path: 'addon',
    type: 'addon'
  }
};

const validBuildTargets = Object.keys(buildDestinations);

module.exports = {
  name: 'ember-cli-tailwind',

  included(includer) {
    this._super.included.apply(this, arguments);

    // If this is set, show a warning
    let buildTarget = includer.options &&
      includer.options[this.name] &&
      includer.options[this.name]['buildTarget'];

    // // fs.readdirSync(includer.project.root + '/app/tailwind')
    // let buildTarget;
    // if (fs.existsSync(includer.project.root + '/app/tailwind')) {
    //   buildTarget = 'app';
    // }

    debugger;
    if (!this._validateBuildTarget(buildTarget, includer)) {
      return;
    }

    let buildConfig = buildDestinations[buildTarget];

    if (this._shouldIncludeStyleguide()) {
      this.import('vendor/etw.css');
    }

    this.projectType = buildConfig.type;
    this.tailwindInputPath = this._getInputPath(this.parent.root, buildConfig.path);
  },

  treeForStyles() {
    if (this.projectType === 'app' && this._hasTailwindConfig()) {
      return this._buildTailwind();
    }
  },

  treeForAddonStyles() {
    if (this.projectType === 'addon' && this._hasTailwindConfig()) {
      return this._buildTailwind();
    }
  },

  treeForApp(tree) {
    let appTree = this._super(tree);

    if (!this._shouldIncludeStyleguide()) {
      appTree = new Funnel(appTree, {
        exclude: ['**/instance-initializers/ember-cli-tailwind.js'],
      });
    }

    return appTree;
  },

  _shouldIncludeStyleguide() {
    let envConfig = this.project.config(process.env.EMBER_ENV)[this.name];
    let shouldOverrideDefault = envConfig !== undefined && envConfig.shouldIncludeStyleguide !== undefined;
    return shouldOverrideDefault ? envConfig.shouldIncludeStyleguide : process.env.EMBER_ENV !== 'production';
  },

  // Private

  _getInputPath(root, inputPath) {
    if (typeof inputPath !== 'string') {
      this.ui.writeWarnLine('Unable to process Tailwind styles for a non-string tree');
      return;
    }

    let fullPath = path.join(root, inputPath, 'tailwind');
    if (fs.existsSync(path.join(fullPath, 'config', 'tailwind.js'))) {
      return fullPath;
    }
  },

  _hasTailwindConfig() {
    return this.tailwindInputPath;
  },

  _buildTailwind() {
    let basePath = this.projectType === 'app' ? 'app/styles' : '';
    let tailwindConfig = new Rollup(this.tailwindInputPath, {
      rollup: {
        input: 'config/tailwind.js',
        output: {
          file: 'tailwind-config.js',
          format: 'cjs'
        },
        plugins: [
          resolve(),
          commonjs()
        ]
      }
    });

    return new BuildTailwindPlugin([this.tailwindInputPath, tailwindConfig], {
      srcFile: path.join('modules.css'),
      destFile: path.join(basePath, 'tailwind.css')
    });
  },

  _validateBuildTarget(buildTarget) {
    // If no build target is found, but we're not in addon, assume something is definitely wrong
    // and print the warning line so app consumers won't be in the dark about their styles not
    // showing up. On the other hand, if it IS an addon, don't print the warning message since
    // since this hook will be run twice regardless of whether or not they're intending to use
    // tailwind in both their addon and dummy app.
    if (!buildTarget) {
      if (!this._isAddon()) {
        this.ui.writeWarnLine('You must specify a buildTarget using an ember-cli-tailwind config object in your app or addon.')
      }
      return false;
    }

    if (buildTarget && !validBuildTargets.includes(buildTarget)) {
      this.ui.writeWarnLine('Your buildTarget is invalid. Valid targets are "app", "addon", or "dummy".')
      return false;
    }

    if (this._tailwindAddonConfigExists() && !this._isDependency()) {
      this.ui.writeError('A Tailwind config was detected in the addon folder, but `ember-cli-tailwind` is not listed as a dependency. Please make sure `ember-cli-tailwind` is listed in `dependencies` (NOT `devDependencies`).');
      return false;
    }

    return true;
  },

  _isAddon() {
    const keywords = this.parent.pkg.keywords;
    return (keywords && keywords.indexOf('ember-addon') !== -1);
  },

  _tailwindAddonConfigExists() {
    return fs.existsSync(path.join(this.parent.root, 'addon', 'tailwind'));
  },

  // Check that `ember-cli-tailwind` is listed in `dependencies` (as opposed to `devDependencies`)
  _isDependency() {
    let deps = this.parent.pkg.dependencies;

    return deps && Object.keys(deps).includes(this.name);
  }
};
