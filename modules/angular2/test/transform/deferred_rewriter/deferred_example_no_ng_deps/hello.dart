library examples.src.hello_world.absolute_url_expression_files;

import 'package:angular2/angular2.dart'
    show bootstrap, Component, Directive, BaseView, NgElement;

@Component(selector: 'hello-app')
@BaseView(templateUrl: 'package:other_package/template.html')
class HelloCmp {}
