require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'XMTPReactNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platform       = :ios, '14.0'
  s.swift_version  = '5.4'
  s.source         = { git: 'https://github.com/xmtp/xmtp-react-native-sdk' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"

  s.dependency "MessagePacker"
  s.dependency "XMTP", "= 4.3.3"
  s.dependency 'CSecp256k1', '~> 0.2'
  s.dependency "SQLCipher", "= 4.5.7"
end
