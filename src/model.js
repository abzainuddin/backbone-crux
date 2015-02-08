// # Model
//
// ### _An extended Backbone.Model with commonly used functions._
//
// Based on [Backbone.Paginator](https://github.com/backbone-paginator/backbone.paginator) to add
// commonly used functions/properties:
//
// 1. Collection attributes
//
//  These attributes are by default send with each fetch.
//
// 2. Sync override
//
//  To add extra before:method and after:method events.
//
// 3. Sensible defaults for requestPager settings.
//
//  Such as using Backbone.Collections' url for paginatore_core.url.
//
// ___
//
// **Author:** AB Zainuddin
//
// **Email:** burhan@codeyellow.nl
//
// **Website:** http://www.codeyellow.nl
//
// **Copyright** Copyright (c) 2013 Code Yellow B.V.
//
// **License:** Distributed under MIT license.
// ___
define(function (require) {
    'use strict';

    // Load modules.
    var Backbone = require('backbone'),
    sync = require('./helper/sync'),
    serializer = require('./helper/serializer'),
    _ = require('underscore');

    var _isPrototypeOf = Object.prototype.isPrototypeOf;
    function isInstanceOf(Constructor, instance) {
        // Detects:
        // - instance = Object.create(Constructor.prototype)
        // - instance = new Constructor
        // - instance = Constructor.extend()  (Backbone-style)
        if (_isPrototypeOf.call(Constructor.prototype, instance) ||
            instance instanceof Constructor ||
            Constructor.__super__ && _isPrototypeOf.call(Constructor.__super__, instance)) {
            return true;
        }
        return false;
    }

    /**
     * @param {Backbone.Model} Model - The model for the attribute hash
     * @param {object} attrs - The JSON-ified attribute hash of the model.
     * @return {boolean} true if the JSON representation of the input is a subset
     *   of the model's default attributes. Nested models and collections are
     *   recursively processed.
     */
    function isEmpty(Model, attrs) {
        // jshint eqnull: true
        if (!attrs) {
            return true;
        }
        // Create a default model, without invoking any constructor.
        var defaultModel = Object.create(Model.prototype);
        // Could contain nested models
        var defaults = _.result(defaultModel, 'defaults') || {};
        // Only compare keys that are set.
        var defaultKeys = Object.keys(defaults).filter(function(key) {
            // Omit "undefined" as well because it disappears when JSON-serialized.
            return _.has(attrs, key) && attrs[key] !== undefined;
        });
        var nonDefaultKeys = _.difference(Object.keys(attrs), defaultKeys);
        if (nonDefaultKeys.length > 0) {
            for (var i = 0; i < nonDefaultKeys.length; ++i) {
                if (attrs[nonDefaultKeys[i]] != null) {
                    // At least one of the non-default keys is not void,
                    // so assume that the model is not empty.
                    return false;
                }
            }
        }
        // Nested models have been flattened.
        var flattenedDefaults = serializer.toJSON(defaults);
        // Check for the remaining keys whether the value is "empty".
        return _.every(defaultKeys, function(key) {
            var attrValue = attrs[key];
            var defaultValue = flattenedDefaults[key];
            var modelValue = defaults[key];
            if (attrValue == null && defaultValue == null) {
                // Both of them are null or undefined
                return true;
            }
            // Collection
            if (isInstanceOf(Backbone.Collection, modelValue)) {
                if (!modelValue.length && _.isEmpty(attrValue)) {
                    // Empty collection.
                    return true;
                }
                var ModelType = modelValue.prototype.model;
                if (!ModelType || !attrValue) {
                    // Not a model, or attrValue is 0, false or ''.
                    return false;
                }
                // Every value must either be a falsey value, or empty according
                // to the model definition.
                // The following assumes that the default collection is empty.
                // TODO: What if the default collection has some values?
                return attrValue.every(function(model_attrs) {
                    return isEmpty(ModelType, model_attrs);
                });
            }
            // If the attribute default value is a model, use the model's rules
            // to check whether the attribute is empty.
            if (isInstanceOf(Backbone.Model, modelValue)) {
                if (_.isEmpty(attrValue) && typeof modelValue.isEmpty == 'function' && modelValue.isEmpty()) {
                    return true;
                }
                return isEmpty(modelValue.constructor, attrValue);
            }
            return _.isEqual(defaultValue, attrValue);
        });
    }

    // Model with default functionality.
    return Backbone.Model.extend({
        // Keep track of latest collections' xhr. This will be overridden with each new request.
        xhr: null,

        /**
         * @return {boolean} whether the model is empty.
         */
        isEmpty: function() {
            return isEmpty(this.constructor, serializer.toJSON(this.attributes));
        },

        /**
         * Saves xhr on fetch.
         *
         * @see Backbone.Model.fetch
         * @param {Object} options
         */
        fetch: function (options) {
            this.xhr = Backbone.Model.prototype.fetch.call(this, options);

            return this.xhr;
        },

        /**
         * Returns a plain object that represents the model's attributes.
         * Object values are recursively converted to JSON.
         * This method SHOULD be used to generate data that can directly be sent
         * to the server with the .save() method.
         */
        toJSON: function () {
            return serializer.toJSON(this.attributes);
        },

        /**
         * Alias for toHuman.
         * 
         * @return {Object}
         */
        serializeData: function () {
            return this.toHuman();
        },
        /**
         * Return a plain object that represents the model's attributes,
         * All values are recursively flattened using the the serializeData method.
         * This method SHOULD be used to create a flat object that is used to feed
         * templates. Models should never be null'd by this method, so that templates
         * can refer to the model's attributes without worrying whether the model
         * exists or not.
         */
        toHuman: function () {
            return serializer.serializeData(this.attributes);
        },
        fromHuman: function (key, val, options) {
            return this.set(key, val, options);
        },
        convertAttributes: function (key, val, options) {
            var attrs;

            if (key === null) return this;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (typeof key === 'object') {
              attrs = key;
              options = val;
            } else {
              (attrs = {})[key] = val;
            }

            return attrs;
        },

        /**
         * Extend sync with events.
         */
        sync: sync.events(Backbone.Model.prototype.sync)
    }, {
        /**
         * @see #isEmpty
         **/
        isEmpty: function(attrs) {
            if (attrs instanceof this) {
                return attrs.isEmpty();
            } else if (!attrs) {
                return true;
            } else {
                var model = Object.create(this.prototype);
                model.constructor = this;
                model.attributes = attrs;
                return model.isEmpty();
            }
        }
    });
});
