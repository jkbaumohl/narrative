/*global define*/
/*jslint white:true,browser:true*/
define([
    'jquery',
    'bluebird',
    'handlebars',
    'kb_common/html',
    'kb_service/client/workspace',
    '../../validation',
    '../../events',
    '../../runtime',
    '../../dom',
    '../../props',
    'bootstrap',
    'css!font-awesome'
], function (
    $,
    Promise,
    Handlebars,
    html,
    Workspace,
    Validation,
    Events,
    Runtime,
    Dom,
    Props
    ) {
    'use strict';

    /*
     * spec
     *   textsubdata_options
     *     allow_custom: 0/1
     *     multiselection: 0/1
     *     placholder: text
     *     show_src_obj: 0/1
     *     subdata_selection:
     *       parameter_id: string
     *       path_to_subdata: array<string>
     *       selection_id: string
     *       subdata_included: array<string>
     *
     */

    // Constants
    var t = html.tag,
        div = t('div'), p = t('p'),
        select = t('select'),
        option = t('option');

    function factory(config) {
        var options = {},
            spec = config.parameterSpec,
            subdataOptions = spec.spec.textsubdata_options,
            parent,
            container,
            $container,
            workspaceId = config.workspaceId,
            subdata = spec.textsubdata_options,
            bus = config.bus,
            runCount = 0,
            model,
            //model = {
            //    referenceObjectName: null,
            //    availableValues: null,
            //    value: null
            //},
            options = {
                objectSelectionPageSize: 20
            },
        runtime = Runtime.make(),
            dom;

        // Validate configuration.
        if (!workspaceId) {
            throw new Error('Workspace id required for the object widget');
        }
        //if (!workspaceUrl) {
        //    throw new Error('Workspace url is required for the object widget');
        //}

        options.enabled = true;
        
        function buildOptions() {
            var availableValues = model.getItem('availableValues'),
                value = model.getItem('value') || [],
                selectOptions = [option({value: ''}, '')];
            if (!availableValues) {
                return selectOptions;
            }
            return selectOptions.concat(availableValues.map(function (availableValue) {
                var selected = false,
                    optionLabel = availableValue.id,
                    optionValue = availableValue.id;
                // TODO: pull the value out of the object
                if (value.indexOf(availableValue.id) >= 0) {
                    selected = true;
                }
                return option({
                    value: optionValue,
                    selected: selected
                }, optionLabel);
            }));
        }
        
        function buildCount() {
            var availableValues = model.getItem('availableValues') || [],
                value = model.getItem('value') || [];
            
            return String(value.length) + ' / ' + String(availableValues.length) + ' items';
        }

        function makeInputControl(events, bus) {
            // There is an input control, and a dropdown,
            // TODO select2 after we get a handle on this...
            var selectOptions,
                size = 1,
                multiple = false,
                availableValues = model.getItem('availableValues'),
                value = model.getItem('value') || [];

            if (subdataOptions.multiselection) {
                size = 10;
                multiple = true;
            }
            if (!availableValues) {
                return p({class: 'form-control-static', style: {fontStyle: 'italic', whiteSpace: 'normal', padding: '3px', border: '1px silver solid'}}, 'Items will be available after selecting a value for ' + subdataOptions.subdata_selection.parameter_id);
            }
            //if (availableValues.length === 0) {
            //    return 'No items found';
            //}

            selectOptions = buildOptions();

            // CONTROL
            return div({style: {border: '1px silver solid'}}, [
                div({style: {fontStyle: 'italic'}, dataElement: 'count'}, buildCount()),
                select({
                    id: events.addEvent({
                        type: 'change',
                        handler: function (e) {
                            validate()
                                .then(function (result) {
                                    if (result.isValid) {
                                        model.setItem('value', result.value);
                                        updateInputControl('value');
                                        bus.emit('changed', {
                                            newValue: result.value
                                        });
                                    } else if (result.diagnosis === 'required-missing') {
                                        model.setItem('value', result.value);
                                        updateInputControl('value');
                                        bus.emit('changed', {
                                            newValue: result.value
                                        });
                                    }
                                    bus.emit('validation', {
                                        errorMessage: result.errorMessage,
                                        diagnosis: result.diagnosis
                                    });
                                });
                        }
                    }),
                    size: size,
                    multiple: multiple,
                    class: 'form-control',
                    dataElement: 'input'
                }, selectOptions)
            ]);
        }
        
        /*
         * Given an existing input control, and new model state, update the
         * control to suite the new data.
         * Cases:
         * 
         * - change in source data - fetch new data, populate available values,
         *   reset selected values, remove existing options, add new options.
         *   
         * - change in selected items - remove all selections, add new selections
         * 
         */
        function updateInputControl(changedProperty) {
            switch (changedProperty) {
                case 'value': 
                    // just change the selections.
                    var count = buildCount();
                    dom.setContent('input-control.count', count);
                    
                    break;
                case 'availableValues':
                    // rebuild the options
                    // re-apply the selections from the value
                    var options = buildOptions(),
                        count = buildCount();
                    dom.setContent('input-control.input', options);
                    dom.setContent('input-control.count', count);
                    
                    break;
                case 'referenceObjectName':
                    // refetch the available values
                    // set available values
                    // update input control for available values
                    // set value to null
                    
                
            }
        }

        /*
         * If the parameter is optional, and is empty, return null.
         * If it allows multiple values, wrap single results in an array
         * There is a weird twist where if it ...
         * well, hmm, the only consumer of this, isValid, expects the values
         * to mirror the input rows, so we shouldn't really filter out any
         * values.
         */
        function getInputValue() {
            var control = dom.getElement('input-container.input');
            if (!control) {
                return null;
            }
            var input = control.selectedOptions,
                i, values = [];
            for (i = 0; i < input.length; i += 1) {
                values.push(input.item(i).value);
            }
            // cute ... allows selecting multiple values but does not expect a sequence...
            return values;
        }

        function resetModelValue() {
            if (spec.spec.default_values && spec.spec.default_values.length > 0) {
                // nb i'm assuming here that this set of strings is actually comma
                // separated string on the other side.
                model.setItem('value', spec.spec.default_values[0].split(','));
            } else {
                model.setItem('value', null);
            }
        }

        function validate() {
            return Promise.try(function () {
                if (!options.enabled) {
                    return {
                        isValid: true,
                        validated: false,
                        diagnosis: 'disabled'
                    };
                }

                var rawValue = getInputValue(),
                    validationOptions = {
                        required: spec.required()
                    };

                return Validation.validateStringSet(rawValue, validationOptions);
            })
                .then(function (validationResult) {
                    return {
                        isValid: validationResult.isValid,
                        validated: true,
                        diagnosis: validationResult.diagnosis,
                        errorMessage: validationResult.errorMessage,
                        value: validationResult.parsedValue
                    };
                });
        }

        // unsafe, but pretty.
        function getProp(obj, props) {
            props.forEach(function (prop) {
                obj = obj[prop];
            });
            return obj;
        }

        // safe, but ugly.
        
        function fetchData() {
            if (!model.getItem('referenceObjectName')) {
                return [];
            }
            var workspace = new Workspace(runtime.config('services.workspace.url'), {
                token: runtime.authToken()
            }),
                options = spec.spec.textsubdata_options,
                subObjectIdentity = {
                    ref: workspaceId + '/' + model.getItem('referenceObjectName'),
                    included: options.subdata_selection.subdata_included
                };
            return workspace.get_object_subset([
                subObjectIdentity
            ])
                .then(function (results) {
                    // We have only one ref, so should just be one result.
                    var values = [],
                        selectionId = options.subdata_selection.selection_id,
                        descriptionTemplate = Handlebars.compile(options.subdata_selection.description_template);
                    results.forEach(function (result) {
                        if (!result) {
                            return;
                        }
                        var subdata = getProp(result.data, options.subdata_selection.path_to_subdata);

                        if (subdata instanceof Array) {
                            // For arrays we pluck off the "selectionId" property from
                            // each item.
                            subdata.forEach(function (datum) {
                                values.push({
                                    id: datum[selectionId],
                                    desc: descriptionTemplate(datum), // TODO
                                    objectRef: [result.info[6], result.info[0], result.info[4]].join('/'),
                                    objectName: result.info[1]
                                });
                            });
                        } else {
                            Object.keys(subdata).forEach(function (key) {
                                var datum = subdata[key],
                                    id;

                                if (selectionId) {
                                    switch (typeof datum) {
                                        case 'object':
                                            id = datum[selectionId];
                                            break;
                                        case 'string':
                                        case 'number':
                                            if (selectionId === 'value') {
                                                id = datum;
                                            } else {
                                                id = key;
                                            }
                                            break;
                                        default:
                                            id = key;
                                    }
                                } else {
                                    id = key;
                                }

                                values.push({
                                    id: id,
                                    desc: descriptionTemplate(datum), // todo
                                    objectRef: [result.info[6], result.info[0], result.info[4]].join('/'),
                                    objectName: result.info[1]
                                });
                            });
                        }
                    });
                    return values;
                })
                .then(function (data) {
                    // sort by id now.
                    data.sort(function (a, b) {
                        if (a.id > b.id) {
                            return 1;
                        }
                        if (a.id < b.id) {
                            return -1;
                        }
                        return 0;
                    });
                    return data;
                });
        }
        
        function syncAvailableValues() {
            return Promise.try(function () {
                return fetchData();
            })
                .then(function (data) {
                    model.setItem('availableValues', data);
                });
        }

        function autoValidate() {
            return validate()
                .then(function (result) {
                    bus.emit('validation', {
                        errorMessage: result.errorMessage,
                        diagnosis: result.diagnosis
                    });
                });
        }


        /*
         * Creates the markup
         * Places it into the dom node
         * Hooks up event listeners
         */
        function render() {
            return Promise.try(function () {
                var events = Events.make(),
                    inputControl = makeInputControl(events, bus),
                    content = div({
                        class: 'input-group',
                        style: {
                            width: '100%'
                        }
                    }, inputControl);

                dom.setContent('input-container', content);
                events.attachEvents(container);
            })
                .then(function () {
                    return autoValidate();
                })
                .catch(function (err) {
                    console.error('ERROR in render', err);
                });
        }

        /*
         * In the layout we set up an environment in which one or more parameter
         * rows may be inserted.
         * For the objectInput, there is only ever one control.
         */
        function layout(events) {
            var content = div({
                dataElement: 'main-panel'
            }, [
                div({
                    dataElement: 'input-container'
                })
            ]);
            return {
                content: content,
                events: events
            };
        }

        function registerEvents() {
            bus.on('reset-to-defaults', function (message) {
                resetModelValue();
                // TODO: this should really be set when the linked field is reset...
                model.setItem('availableValues', []);
                model.setItem('referenceObjectName', null);
                updateInputControl('availableValues');
                updateInputControl('value');
            });
            bus.on('update', function (message) {
                model.setItem('value', message.value);
                updateInputControl('value');
            });
            // NEW
            // Called when for an update to any param. This is necessary for
            // any parameter which has a dependency upon any other.

            //                bus.receive({
            //                    test: function (message) {
            //                        return (message.type === 'parameter-changed');
            //                    },
            //                    handle: function(message) {
            //                        console.log('parameter changed', message);
            //                   bus }
            //                });

            bus.on('parameter-changed', function (message) {
                if (message.parameter === subdataOptions.subdata_selection.parameter_id) {
                    var newValue = message.newValue;
                    if (message.newValue === '') {
                        newValue = null;
                    }
                    model.setItem('referenceObjectName', newValue);
                    syncAvailableValues()
                        .then(function () {
                            updateInputControl('availableValues');
                        })
                        .catch(function (err) {
                                console.error('ERROR syncing available values', err);
                        });
                }
            });

            // This control has a dependency relationship in that its
            // selection of available values is dependent upon a sub-property
            // of an object referenced by another parameter.
            // Rather than explicitly refer to that parameter, we have a
            // generic capability to receive updates for that value, after
            // which we re-fetch the values, and re-render the control.
//            bus.on('update-reference-object', function (message) {
//                model.setItem('referenceObjectName', value)
//                setReferenceValue(message.objectRef);
//            });
            bus.emit('sync');
        }

        // LIFECYCLE API

        function start() {
            return Promise.try(function () {
                bus.on('run', function (message) {
                    parent = message.node;
                    container = parent.appendChild(document.createElement('div'));
                    $container = $(container);
                    dom = Dom.make({
                        node: container
                    });

                    var events = Events.make(),
                        theLayout = layout(events);

                    container.innerHTML = theLayout.content;
                    
                    render();
                    
                    events.attachEvents(container);

                    registerEvents();
                });
            });
        }

        // MAIN

        model = Props.make({
            data: {
                referenceObjectName: null,
                availableValues: [],
                value: null
            }
            //,
            //onUpdate: function (props) {
            //    // render();
            //    updateInputControl(props);
            // }
        });

        return {
            start: start
        };
    }

    return {
        make: function (config) {
            return factory(config);
        }
    };
});