# MISSION
Analyze the code provided as context and provide a unit test.

# REFERENCE
class cl_abap_unit_assert definition.
    public section.
        methods assert_equals importing act type any exp type any.
endclass.

interface if_cds_test_environment.
  methods get_double importing i_name type c
                               returning value(r_result) type ref to if_cds_stub.
endinterface.
 
interface if_cds_stub.
  methods insert importing i_test_data type ref to if_cds_test_data.
endinterface.

# STEPS
1. Generate test class
  - Use "CLASS lcl_test DEFINITION FOR TESTING DURATION SHORT RISK LEVEL HARMLESS." to define test class.
  - If contexts contains selected content, provide the source code of the unit tests JUST for the selected code.
  - Keep all tests separate and independent - single test function per one test scenario.
  - Use class cl_abap_unit_assert for assertion. Refer to REFERENCE for method definition.

2. IF source code is a class, THEN: 
  2.1. In "PRIVATE SECTION":
     - Declare an "DATA mo_cut" for test object.
     - Declare an "METHODS setup."
     - ONLY generate test method for ALL public methods. For example: METHODS test_select FOR TESTING. Length of method name is less than 30 characters.
     - Implement setup method to create test object. If GET_INSTANCE method exist in source code, use it to create test object.

3. IF source code is a CDS, THEN:
  3.1. Suggest belows in "PRIVATE SECTION":
    - Include "CLASS-DATA mo_cds_env TYPE REF TO if_cds_test_environment.".
    - Include "CLASS-METHODS class_setup."
    - Include "CLASS-METHODS class_teardown."
    - Include MOCK DATA methods for all dependencies. For example: METHODS mock_data_for_mara.
    - Include some test methods. For example: METHODS test_select_valid FOR TESTING.
  
  3.2. Create object mo_cds_env in class_setup with method "cl_cds_test_environment=>create", parameter i_for_entity is CDS ID. CDS ID is after "DEFINE" keyword in the source code.
 
  3.3. In method "class_teardown" call method "mo_sql_env->destroy" .
 
  3.4. in method "setup" call method "mo_sql_env->clear_doubles( )."
 
  3.5. With each mock data method
    - 3.5.1 Mock data for dependency. Use dependency ID to declare internal table, for example "DATA lt_testdata type standard table of MARA".
    - 3.5.2 Call method "cl_cds_test_data=>create" to create test data from step 3.5.1. Use this example to declare test data object "DATA lo_testdata type ref to if_cds_stub".
    - 3.5.3 Call method mo_sql_env->get_double to create test double for dependency. For example: DATA(lo_double) = mo_sql_env->get_double( 'MARA' ).
    - 3.5.4 Call method "insert" of test double from 3.5.3 and pass test data from 3.5.2

4. Format literals
  - Literal should enclose with ' and '.