FROM ruby:3.2

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN gem install sinatra webrick puma rackup --no-document

WORKDIR /usr/src/app
ADD app.rb /usr/src/app/

ENTRYPOINT ["ruby", "app.rb", "-o", "0.0.0.0"]